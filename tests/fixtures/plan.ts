// plan §17 — Shared test fixture for SignedPlan / RunnerStep shapes.
// Keeps tests/store.test.ts, tests/runner.test.ts, and app/api/demo/run/route.ts honest.

import type { SignedPlan, RunnerStep } from "../../lib/schema/plan.js";
import type { RunnerStepKind } from "../../lib/runner/types.js";

export function fakeStep(overrides: Partial<RunnerStep> = {}): RunnerStep {
  return {
    id: "step-1",
    kind: "file-write" as RunnerStepKind,
    path: "src/index.ts",
    description: "Write entry point",
    ...overrides,
  };
}

export function fakeSignedPlan(overrides: Partial<SignedPlan> = {}): SignedPlan {
  return {
    id: "plan-test-1",
    title: "Test plan",
    repository: "owner/repo",
    etappe: 17,
    steps: [fakeStep()],
    signature: "sha256-test",
    createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
    ...overrides,
  };
}
