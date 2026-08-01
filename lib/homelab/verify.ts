import type { CheckResult, CheckVerdict, ExecutionReport, StepResult } from "../schema/homelab";

/**
 * Verification (plan §18).
 *
 * An exit code of zero is not proof. A step that ran without complaining says
 * only that a process ended; whether the thing it was supposed to bring about
 * is actually true has to be looked at separately. Every check therefore has
 * to *observe* something, and anything unobserved stays `not_proven`.
 */

const RANK: Record<CheckVerdict, number> = {
  passed: 0,
  partially_passed: 1,
  not_applicable: 2,
  not_proven: 3,
  failed: 4,
};

/** A report is never better than its weakest check. */
export function overallVerdict(checks: CheckResult[]): CheckVerdict {
  if (checks.length === 0) return "not_proven";
  return checks.reduce<CheckVerdict>(
    (worst, check) => (RANK[check.verdict] > RANK[worst] ? check.verdict : worst),
    "passed",
  );
}

export interface ObservedState {
  /** Model names the runtime reports as available. */
  availableModels?: string[];
  /** Model names the runtime reports as currently resident. */
  residentModels?: string[];
  /** Output of a test inference, if one was made. */
  inferenceOutput?: string;
  /** Free VRAM before and after, in gigabytes. */
  freeVramBeforeGb?: number;
  freeVramAfterGb?: number;
}

function check(id: string, description: string, verdict: CheckVerdict, observed: string): CheckResult {
  return { id, description, verdict, observed };
}

/**
 * Turns what was measured into verdicts. Deliberately dull: each check looks
 * at one observation and refuses to infer anything from the others.
 */
export function evaluateChecks(state: ObservedState, expectedModel?: string): CheckResult[] {
  const checks: CheckResult[] = [];

  if (state.availableModels === undefined) {
    checks.push(check("model-available", "Das Modell ist auf dem Node vorhanden.", "not_proven", "Nicht abgefragt."));
  } else if (!expectedModel) {
    checks.push(check("model-available", "Das Modell ist auf dem Node vorhanden.", "not_applicable", "Kein Modell erwartet."));
  } else {
    const present = state.availableModels.some((m) => m.startsWith(expectedModel));
    checks.push(
      check(
        "model-available",
        `Das Modell ${expectedModel} ist auf dem Node vorhanden.`,
        present ? "passed" : "failed",
        present ? `Gefunden unter: ${state.availableModels.join(", ")}` : `Nur vorhanden: ${state.availableModels.join(", ") || "nichts"}`,
      ),
    );
  }

  if (state.inferenceOutput === undefined) {
    checks.push(check("test-inference", "Eine Testinferenz liefert eine Antwort.", "not_proven", "Nicht ausgeführt."));
  } else {
    const answered = state.inferenceOutput.trim().length > 0;
    checks.push(
      check(
        "test-inference",
        "Eine Testinferenz liefert eine Antwort.",
        answered ? "passed" : "failed",
        answered ? `${state.inferenceOutput.trim().slice(0, 120)}` : "Leere Antwort.",
      ),
    );
  }

  if (state.residentModels === undefined) {
    checks.push(check("model-unloaded", "Nach dem Stop ist kein Modell mehr resident.", "not_proven", "Nicht abgefragt."));
  } else {
    const stillResident = expectedModel
      ? state.residentModels.some((m) => m.startsWith(expectedModel))
      : state.residentModels.length > 0;
    checks.push(
      check(
        "model-unloaded",
        "Nach dem Stop ist kein Modell mehr resident.",
        stillResident ? "failed" : "passed",
        stillResident ? `Noch resident: ${state.residentModels.join(", ")}` : "Nichts mehr resident.",
      ),
    );
  }

  const { freeVramBeforeGb: before, freeVramAfterGb: after } = state;
  if (before === undefined || after === undefined) {
    checks.push(
      check("resources-released", "Der belegte Speicher wurde wieder freigegeben.", "not_proven", "Nicht beidseitig gemessen."),
    );
  } else {
    const recovered = after - before;
    checks.push(
      check(
        "resources-released",
        "Der belegte Speicher wurde wieder freigegeben.",
        recovered >= 0 ? "passed" : "failed",
        `Frei vorher ${before} GB, nachher ${after} GB (${recovered >= 0 ? "+" : ""}${Math.round(recovered * 100) / 100} GB).`,
      ),
    );
  }

  return checks;
}

export function buildReport(input: {
  planId: string;
  nodeId: string;
  startedAt: string;
  finishedAt: string;
  steps: StepResult[];
  checks: CheckResult[];
}): ExecutionReport {
  // A failed step cannot produce a passing report, whatever the checks say.
  const stepFailed = input.steps.some((s) => s.exitCode !== null && s.exitCode !== 0);
  const fromChecks = overallVerdict(input.checks);
  const verdict: CheckVerdict = stepFailed && RANK[fromChecks] < RANK.failed ? "failed" : fromChecks;

  return { ...input, verdict };
}
