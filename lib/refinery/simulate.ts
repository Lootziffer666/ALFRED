import type { MergeSimulation, RefineryState } from "./types";
import { buildConflictRecord } from "./classify";

/**
 * Merge-Simulation (Etappe 9b).
 *
 * Die Simulation läuft gegen eine frische Zielbasis — nicht gegen den
 * aktuellen HEAD des Branches, der zuletzt geschrieben hat. Sie läuft
 * nie in einem Branch mit einem aktiven schreibenden Agent.
 *
 * Ein Post-Merge-Healthcheck ist Pflicht. postMergeHealthPassed bleibt
 * null bis der Check tatsächlich ausgeführt wurde.
 */

export function createSimulation(prId: string, headSha: string, baseSha: string): MergeSimulation {
  return {
    prId,
    headSha,
    baseSha,
    state: "submitted",
    conflicts: [],
    clean: false,
    postMergeHealthPassed: null,
    simulatedAt: new Date().toISOString(),
    mergedAt: null,
    rejectionReason: null,
  };
}

export function transition(
  sim: MergeSimulation,
  next: RefineryState,
  reason?: string,
): MergeSimulation {
  return {
    ...sim,
    state: next,
    rejectionReason:
      next === "rejected" || next === "escalated"
        ? (reason ?? sim.rejectionReason)
        : sim.rejectionReason,
    mergedAt: next === "merged" ? new Date().toISOString() : sim.mergedAt,
  };
}

export interface RawConflict {
  path: string;
  hunk: string;
  detail: string;
}

export function applyConflicts(
  sim: MergeSimulation,
  rawConflicts: RawConflict[],
): MergeSimulation {
  const records = rawConflicts.map((c) =>
    buildConflictRecord(c.path, c.hunk, c.detail)
  );

  const clean =
    records.length === 0 ||
    records.every((r) => r.autoRepairable && r.verdict === "repaired");

  const hasBlocked = records.some((r) => r.verdict === "merge-blocked");
  const hasEscalated = records.some((r) => r.verdict === "escalation-required");

  let next: RefineryState = "conflict-classified";
  if (hasBlocked) next = "rejected";
  else if (hasEscalated) next = "escalated";
  else if (clean) next = "repaired";

  return {
    ...sim,
    conflicts: records,
    clean,
    state: next,
    rejectionReason: hasBlocked
      ? records.find((r) => r.verdict === "merge-blocked")?.detail ?? null
      : sim.rejectionReason,
  };
}

export function recordPostMergeHealth(
  sim: MergeSimulation,
  passed: boolean,
): MergeSimulation {
  if (sim.state !== "merged") {
    throw new Error(`Post-Merge-Healthcheck erfordert state=merged, ist aber: ${sim.state}`);
  }

  return {
    ...sim,
    postMergeHealthPassed: passed,
    state: passed ? "post-merge-verified" : "rejected",
    rejectionReason: passed ? sim.rejectionReason : "Post-Merge-Healthcheck fehlgeschlagen.",
  };
}

/** Gibt true zurück wenn der Merge freigegeben werden darf. */
export function canMerge(sim: MergeSimulation): boolean {
  return (
    sim.state === "queue-ready" ||
    sim.state === "final-rebase-check"
  );
}
