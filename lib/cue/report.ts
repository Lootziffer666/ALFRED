import type { CueCheckKind, CueCheckResult, CueReport, CueVerdict } from "./types";

/**
 * Bericht-Zusammensetzung (Etappe 10c).
 *
 * Das Gesamtverdikt ist das schlechteste Einzelergebnis.
 * Reihenfolge (schlimmste zuerst): failed > not-proven > partially-passed > not-applicable > passed
 */

const VERDICT_RANK: Record<CueVerdict, number> = {
  failed: 0,
  "not-proven": 1,
  "partially-passed": 2,
  "not-applicable": 3,
  passed: 4,
};

export function worstVerdict(verdicts: CueVerdict[]): CueVerdict {
  if (verdicts.length === 0) return "not-applicable";
  return verdicts.reduce((worst, v) =>
    VERDICT_RANK[v] < VERDICT_RANK[worst] ? v : worst,
  );
}

let _seq = 0;

function nextReportId(): string {
  return `cue-${Date.now()}-${++_seq}`;
}

export function buildCueReport(
  taskId: string,
  planId: string,
  checks: CueCheckResult[],
): CueReport {
  const overall = worstVerdict(checks.map((c) => c.verdict));

  const blocksRelease =
    overall === "failed" || overall === "not-proven";

  return {
    reportId: nextReportId(),
    taskId,
    planId,
    overall,
    checks,
    blocksRelease,
    createdAt: new Date().toISOString(),
  };
}

/** Placeholder-Implementierung von CueAgent für Etappe 10. */
export function makeStaticCueCheck(
  kind: CueCheckKind,
  verdict: CueVerdict,
  reason: string,
  evidence: string[] = [],
): CueCheckResult {
  return { kind, verdict, reason, evidence, checkedAt: new Date().toISOString() };
}
