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

const DOC_RELEVANT_GLOBS = ["lib/**", "app/api/**", "bin/**", "PLAN.md"];
const DAEMON_AUTHOR_MARKER = "alfret-daemon[bot]";

export const readmeFreshnessJob: Job = {
  name: "readme-freshness",

  async run(jc: JobContext): Promise<JobResult> {
    const { ctx, repo, log } = jc;

    if (!ctx.creds.token) return { status: "skipped", findings: [], writes: [] };

    const state = await getJobState(ctx.store, "readme-freshness", repo.repository);
    if (hasOpenProposal(state)) {
      log.info("Offener README-Vorschlag existiert bereits — übersprungen.", {
        pr: state?.openPrNumber,
      });
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

    if (!lastMergedPr)
      return { status: "ok", findings, writes: [] };

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
        "Marker fehlen oder kein inhaltlicher Unterschied — README bleibt unangetastet.",
        { reason: replacement.reason },
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

// Platzhalter für tatsächliche GitHub-Reads — echte Implementierung nutzt ghFetch/compareRefs aus Etappe 27.
async function fetchLastMergedPr(
  _repo: string,
  _token: string,
  _excludeAuthor: string,
): Promise<{ mergedAt: string; number: number } | null> {
  return null;
}

async function fetchLastReadmeCommit(
  _repo: string,
  _token: string,
): Promise<{ date: string } | null> {
  return null;
}

async function anyDocRelevantChangesSince(
  _repo: string,
  _token: string,
  _sinceDate: string,
  globs: string[],
): Promise<boolean> {
  void globs.map((g) => globToRegExp(g));
  return false;
}

async function fetchReadmeContent(
  _repo: string,
  _token: string,
): Promise<string> {
  return "";
}

async function countPlanEtappen(
  _repo: string,
  _token: string,
): Promise<number> {
  return 0;
}

function buildStatusBlock(_repo: string, _pr: { number: number }): string {
  return "";
}
