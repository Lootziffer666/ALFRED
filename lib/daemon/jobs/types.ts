// Job-Interface und Ergebnistypen.
//
// PlannedWrite ist die Naht zwischen Beobachten und Handeln:
//   - Ein Job berechnet, was er tun *würde*, und gibt PlannedWrite[] zurück.
//   - Der Executor (Etappe 27) entscheidet, ob er sie anwendet.
//   - DryRun kostet genau ein `if` im Executor.
//
// Solange der Executor nicht existiert, werden writes still gelogged und verworfen.

import type { DaemonContext } from "../context";
import type { ResolvedRepoConfig } from "../config";
import type { MaidFinding } from "../../maid/types";

// ---------------------------------------------------------------------------
// PlannedWrite
// ---------------------------------------------------------------------------

export type PlannedWriteKind =
  | "commit-files"
  | "create-branch"
  | "delete-branch"
  | "create-pr"
  | "update-pr-branch";

export interface PlannedWrite {
  kind: PlannedWriteKind;
  repository: string;
  /** Menschenlesbare Begründung — erscheint im Audit-Log. */
  reason: string;
  /** Kind-spezifische Nutzlast. Wird in Etappe 27 typisiert. */
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// JobResult
// ---------------------------------------------------------------------------

export type JobStatus = "ok" | "skipped" | "degraded" | "failed";

export interface JobResult {
  status: JobStatus;
  findings: MaidFinding[];
  writes: PlannedWrite[];
  meta?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Job-Interface
// ---------------------------------------------------------------------------

export interface JobContext {
  ctx: DaemonContext;
  repo: ResolvedRepoConfig;
  /** Scoped Logger, vorgebunden mit { repository, job }. */
  log: ReturnType<DaemonContext["log"]["child"]>;
}

export interface Job {
  readonly name: string;
  run(jc: JobContext): Promise<JobResult>;
}

// ---------------------------------------------------------------------------
// TickResult — im AlfretStore gespeichert (kind: "daemon-tick")
// ---------------------------------------------------------------------------

export interface RepoTickSummary {
  repository: string;
  jobResults: Array<{
    job: string;
    status: JobStatus;
    findingCount: number;
    writeCount: number;
  }>;
  durationMs: number;
}

export interface TickResult {
  kind: "daemon-tick";
  id: string;
  tickedAt: string;
  repos: RepoTickSummary[];
  totalDurationMs: number;
}
