// plan §29 — Drei Reads, keine Heuristik:
// 1. letzter gemergter PR (merged_at)
// 2. letzte README-Änderung (GET commits?path=README.md&per_page=1)
// 3. bei Rückstand: geänderte Pfade der PRs dazwischen gegen docRelevantGlobs
//
// Befund → Folge:
// README ≥ letzter PR                              → frisch, kein Finding
// älter, aber nichts Doku-Relevantes berührt        → info, kein Schreibvorgang
// älter UND Doku-Relevantes berührt                 → warning "doc-update-needed" + PlannedWrite
//
// Der Widerspruch "README behauptet 11, Git zeigt 16+" wird als eigenes
// "stale-documentation"-Finding gemeldet, NIE automatisch korrigiert — der
// betroffene Satz liegt außerhalb der Marker. Evidence-first statt LLM-Prosa.
//
// Zusätzlich: Daemon committet unter erkennbarem Autor und ignoriert seine
// eigenen Commits bei der Frischeberechnung. Das ist der Unterschied
// zwischen "ruhig" und "alle 15 Minuten ein neuer PR, für immer".
// Ziel ist ein PR, NIE main — auch wenn direkte Commits gewünscht wären.
// Ein Config-Flip später kann das ändern, ist aber nicht Teil dieser Etappe.

import type { Job, JobContext, JobResult } from "./types.js";
import { ghFetch } from "../../github.js";
import {
  replaceMarkedBlock,
  findStaleEtappenClaim,
} from "../../readme/markers.js";
import {
  getJobState,
  saveJobState,
  hasOpenProposal,
  jobStateId,
} from "./job-state.js";
import { globToRegExp } from "../../maid/gitignore.js";
import { narrator } from "../narration.js";

const DOC_RELEVANT_GLOBS = ["lib/**", "app/api/**", "bin/**", "PLAN.md"];
const DAEMON_AUTHOR_MARKER = "alfret-daemon[bot]";

export const readmeFreshnessJob: Job = {
  name: "readme-freshness",

  async run(jc: JobContext): Promise<JobResult> {
    const { ctx, repo, log } = jc;

    if (!ctx.creds.token) return { status: "skipped", findings: [], writes: [] };

    const state = await getJobState(ctx.store, "readme-freshness", repo.repository);
    if (hasOpenProposal(state)) {
      log.info(
        narrator.general.nothing({ repository: repo.repository, detail: "Offener README-PR existiert bereits" })
      );
      return { status: "skipped", findings: [], writes: [] };
    }

    const readmeContent = await fetchReadmeContent(repo.repository, ctx.creds.token);
    const findings: JobResult["findings"] = [];

    // Widerspruch ("Alle N Etappen") — unabhängig von Frische, nie automatisch korrigiert.
    const planEtappenCount = await countPlanEtappen(
      repo.repository,
      ctx.creds.token,
    );
    const staleClaim = findStaleEtappenClaim(readmeContent, planEtappenCount);
    if (staleClaim) {
      log.warn(
        narrator.readme.etappenMismatch({
          repository: repo.repository,
          detail: `Alle ${staleClaim.claimed} Etappen`,
          metric: planEtappenCount,
        })
      );
      findings.push({
        kind: "stale-documentation",
        severity: "warning",
        path: "README.md",
        detail: `README behauptet "${staleClaim.claimed} Etappen", PLAN.md zeigt ${planEtappenCount}.`,
        autoFixable: false,
        observedAt: ctx.now().toISOString(),
      });
    }

    // Read 1: letzter gemergter PR (unter Ausschluss der eigenen Daemon-Commits/PRs)
    const lastMergedPr = await fetchLastMergedPr(
      repo.repository,
      ctx.creds.token,
      DAEMON_AUTHOR_MARKER,
    );

    if (!lastMergedPr) {
      log.info(narrator.readme.noLastPr({ repository: repo.repository }));
      return { status: "ok", findings, writes: [] };
    }

    // Read 2: letzte README-Änderung
    const lastReadmeChange = await fetchLastReadmeCommit(
      repo.repository,
      ctx.creds.token,
    );

    if (!lastReadmeChange || lastReadmeChange.date >= lastMergedPr.mergedAt) {
      return { status: "ok", findings, writes: [] }; // README ist frisch
    }

    // Read 3: geänderte Pfade der PRs zwischen README-Änderung und jetzt
    const touchedDocRelevant = await anyDocRelevantChangesSince(
      repo.repository,
      ctx.creds.token,
      lastReadmeChange.date,
      DOC_RELEVANT_GLOBS,
    );

    if (!touchedDocRelevant) {
      log.info(
        narrator.readme.noChange({
          repository: repo.repository,
          detail: "README ist älter, aber keine doc-relevanten Änderungen",
        })
      );
      findings.push({
        kind: "stale-documentation",
        severity: "info",
        path: "README.md",
        detail:
          "README ist älter als der letzte PR, aber nichts Doku-Relevantes wurde berührt.",
        autoFixable: false,
        observedAt: ctx.now().toISOString(),
      });

      return { status: "ok", findings, writes: [] };
    }

    const replacement = replaceMarkedBlock(
      readmeContent,
      buildStatusBlock(repo.repository, lastMergedPr),
      { insertIfMissing: false },
    );

    if (!replacement.changed) {
      log.info(
        narrator.readme.markersMissing({
          repository: repo.repository,
          detail: replacement.reason,
        })
      );
      findings.push({
        kind: "doc-update-needed",
        severity: "warning",
        path: "README.md",
        detail: replacement.reason,
        autoFixable: false,
        observedAt: ctx.now().toISOString(),
      });

      return { status: "ok", findings, writes: [] };
    }

    log.warn(
      narrator.readme.updateNeeded({
        repository: repo.repository,
        detail: "README ist veraltet und Doku-Relevantes wurde geändert",
      })
    );

    findings.push({
      kind: "doc-update-needed",
      severity: "warning",
      path: "README.md",
      detail: "README ist veraltet und Doku-Relevantes wurde geändert.",
      autoFixable: true,
      observedAt: ctx.now().toISOString(),
    });

    const branchName = `alfret/readme-freshness-${ctx.now().getTime()}`;

    // Schleifenschutz aktualisieren: neuer PR ist "offen", bis er gemergt wird.
    await saveJobState(ctx.store, {
      kind: "daemon-job-state",
      id: jobStateId("readme-freshness", repo.repository),
      lastProposedForPrNumber: state?.lastProposedForPrNumber ?? null,
      openPrNumber: -1, // Platzhalter bis create-pr die echte Nummer liefert
      updatedAt: ctx.now().toISOString(),
    });

    return {
      status: "ok",
      findings,
      writes: [
        {
          kind: "commit-files",
          repository: repo.repository,
          reason: "README-Statusblock aktualisieren (automatisch erkannt).",
          payload: {
            branch: branchName,
            message: "docs: README-Status aktualisieren",
            files: [{ path: "README.md", content: replacement.newContent }],
          },
        },
        {
          kind: "create-pr",
          repository: repo.repository,
          reason: "PR für README-Statusaktualisierung öffnen.",
          payload: {
            title: "docs: README-Status aktualisieren",
            body: `Automatisch erzeugt von ${DAEMON_AUTHOR_MARKER}. Nur der markierte Statusblock wurde geändert.`,
            head: branchName,
            base: "main",
          },
        },
      ],
    };
  },
};

// GitHub API implementation for readme-freshness checks.
async function fetchLastMergedPr(
  repo: string,
  token: string,
  excludeAuthor: string,
): Promise<{ mergedAt: string; number: number } | null> {
  const [owner, name] = repo.split("/");

  // Fetch merged PRs, excluding daemon-authored commits.
  const url = `https://api.github.com/repos/${owner}/${name}/pulls?state=closed&sort=updated&direction=desc&per_page=30`;
  const result = await ghFetch<Array<{
    number: number;
    merged_at: string | null;
    user?: { login: string };
  }>>(url, token);

  if (!result.ok || !result.data) return null;

  for (const pr of result.data) {
    if (pr.merged_at && pr.user?.login !== excludeAuthor) {
      return {
        mergedAt: pr.merged_at,
        number: pr.number,
      };
    }
  }

  return null;
}

async function fetchLastReadmeCommit(
  repo: string,
  token: string,
): Promise<{ date: string } | null> {
  const [owner, name] = repo.split("/");

  const url = `https://api.github.com/repos/${owner}/${name}/commits?path=README.md&per_page=1`;
  const result = await ghFetch<Array<{
    commit: { author?: { date: string } };
  }>>(url, token);

  if (!result.ok || !result.data || result.data.length === 0) return null;

  return {
    date: result.data[0].commit.author?.date || new Date().toISOString(),
  };
}

async function anyDocRelevantChangesSince(
  repo: string,
  token: string,
  sinceDate: string,
  globs: string[],
): Promise<boolean> {
  const [owner, name] = repo.split("/");

  // Convert date string to ISO format if needed.
  const since = new Date(sinceDate).toISOString().split("T")[0];

  // Fetch commits since the given date.
  const url = `https://api.github.com/repos/${owner}/${name}/commits?since=${encodeURIComponent(since)}&per_page=100`;
  const result = await ghFetch<Array<{
    files?: Array<{ filename: string }>;
  }>>(url, token);

  if (!result.ok || !result.data) return false;

  // Compile globs into regex patterns.
  const patterns = globs.map((g) => globToRegExp(g));

  // Check if any file matches the doc-relevant globs.
  for (const commit of result.data) {
    if (commit.files) {
      for (const file of commit.files) {
        for (const pattern of patterns) {
          if (pattern.test(file.filename)) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

async function fetchReadmeContent(
  repo: string,
  token: string,
): Promise<string> {
  const [owner, name] = repo.split("/");

  const url = `https://api.github.com/repos/${owner}/${name}/contents/README.md`;
  const result = await ghFetch<{
    content: string;
  }>(url, token);

  if (!result.ok || !result.data) return "";

  // GitHub returns base64-encoded content.
  try {
    return Buffer.from(result.data.content, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

async function countPlanEtappen(
  repo: string,
  token: string,
): Promise<number> {
  const [owner, name] = repo.split("/");

  const url = `https://api.github.com/repos/${owner}/${name}/contents/PLAN.md`;
  const result = await ghFetch<{
    content: string;
  }>(url, token);

  if (!result.ok || !result.data) return 0;

  try {
    const planContent = Buffer.from(result.data.content, "base64").toString("utf-8");
    // Count occurrences of "## §N" pattern in PLAN.md.
    const matches = planContent.match(/^##\s+§(\d+)/gm) || [];
    return matches.length;
  } catch {
    return 0;
  }
}

function buildStatusBlock(repo: string, pr: { number: number }): string {
  // Build a markdown status block showing the latest PR status.
  return `<!-- alfret:begin status -->
**Latest Update:** PR #${pr.number} (${repo})
<!-- alfret:end status -->`;
}
