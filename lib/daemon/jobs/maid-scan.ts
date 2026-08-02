// Maid-Scan-Job: reine Beobachtung, null Schreibzugriffe.
// Beweist die Scheduler-Schleife End-to-End gegen ein echtes Repo — null Blast-Radius.
// Holt den Repo-Tree über fetchRepoEvidence, klassifiziert jeden Pfad,
// speichert den MaidReport unter "${repository}@${commitSha}".

import type { Job, JobContext, JobResult } from "./types.js";
import type { MaidReport } from "../../maid/types.js";
import { classifyPath } from "../../maid/classify.js";
import { fetchRepoEvidence } from "../../github.js";

export const maidScanJob: Job = {
  name: "maid-scan",

  async run(jc: JobContext): Promise<JobResult> {
    const { ctx, repo, log } = jc;

    if (!ctx.creds.token) {
      log.warn("kein Token — maid-scan übersprungen");
      return { status: "skipped", findings: [], writes: [] };
    }

    const [owner, name] = repo.repository.split("/");
    if (!owner || !name) {
      return { status: "failed", findings: [], writes: [], meta: { error: "Invalid repository format" } };
    }

    let evidence: Awaited<ReturnType<typeof fetchRepoEvidence>>;
    try {
      evidence = await fetchRepoEvidence({ owner, name, token: ctx.creds.token });
    } catch (err) {
      const msg = String(err);
      if (msg.includes("rate limit") || msg.includes("403")) {
        return {
          status: "degraded",
          findings: [],
          writes: [],
          meta: { rateLimited: true },
        };
      }

      log.error("fetchRepoEvidence fehlgeschlagen", { error: msg });
      return { status: "failed", findings: [], writes: [], meta: { error: msg } };
    }

    const commitSha = evidence.commits?.status === "loaded" ? evidence.commits.data[0]?.sha ?? "unknown" : "unknown";
    const now = ctx.now().toISOString();

    const report: MaidReport = {
      repository: repo.repository,
      commitSha,
      findings: [],
      proposals: [],
      classifiedFiles: {},
      runAt: now,
    };

    const treeEntries = evidence.tree?.status === "loaded" ? evidence.tree.data : [];
    for (const file of treeEntries ?? []) {
      const cls = classifyPath(file.path, file.size ?? 0);
      report.classifiedFiles[file.path] = cls;

      if (cls === "temporary" || cls === "delete-candidate") {
        report.findings.push({
          kind: "temporary-output",
          severity: "info",
          path: file.path,
          detail: `Klassifiziert als ${cls}`,
          autoFixable: false,
          observedAt: now,
        });
      }
    }

    await ctx.store.put({
      kind: "maid-report",
      id: `${repo.repository}@${commitSha}`,
      ...report,
    });

    log.info("maid-scan abgeschlossen", {
      files: Object.keys(report.classifiedFiles).length,
      findings: report.findings.length,
      commitSha,
    });

    return { status: "ok", findings: report.findings, writes: [] };
  },
};
