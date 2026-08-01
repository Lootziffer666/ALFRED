import { execFile } from "node:child_process";
import type { ExecutionReport, SignedExecutionPlan, StepResult } from "../../lib/schema/homelab";
import { buildReport, evaluateChecks, type ObservedState } from "../../lib/homelab/verify";
import { probeNode, takeSnapshot } from "./probe";
import type { AdapterRegistry } from "./adapters";

/**
 * Step execution (plan §17.4).
 *
 * Commands come from the adapter, assembled from validated parameters and run
 * as an argument vector. No shell is spawned anywhere here, so nothing a plan
 * carries can become a command — the worst a bad parameter can do is fail
 * validation before this file ever sees it.
 */

export interface ExecutionIo {
  nodeId: string;
  root: string;
  adapters: AdapterRegistry;
  now?: () => Date;
}

function runCommand(argv: string[], timeoutSeconds: number): Promise<{ exitCode: number | null; output: string; error?: string }> {
  return new Promise((resolve) => {
    const [command, ...args] = argv;
    execFile(
      command,
      args,
      { timeout: timeoutSeconds * 1000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const output = `${stdout ?? ""}${stderr ?? ""}`.trim().slice(0, 8000);
        if (!error) return resolve({ exitCode: 0, output });
        const exitCode = typeof (error as { code?: unknown }).code === "number" ? (error.code as number) : null;
        resolve({ exitCode, output, error: error.message });
      },
    );
  });
}

async function runStep(step: SignedExecutionPlan["steps"][number], io: ExecutionIo): Promise<StepResult> {
  const startedAt = (io.now?.() ?? new Date()).toISOString();
  const adapter = io.adapters.get(step.adapterId)!;

  // The probe runs in this process; there is nothing to shell out to.
  if (step.kind === "probe-node") {
    const observation = await probeNode(io.nodeId, io.root);
    return {
      kind: step.kind,
      adapterId: adapter.id,
      startedAt,
      finishedAt: (io.now?.() ?? new Date()).toISOString(),
      exitCode: 0,
      output: JSON.stringify(observation),
    };
  }

  const command = adapter.command(step);
  if (!command) {
    return {
      kind: step.kind,
      adapterId: adapter.id,
      startedAt,
      finishedAt: (io.now?.() ?? new Date()).toISOString(),
      exitCode: null,
      output: "",
      error: `Adapter ${adapter.id} liefert für „${step.kind}" kein Kommando.`,
    };
  }

  const result = await runCommand(command.argv, command.timeoutSeconds);
  return {
    kind: step.kind,
    adapterId: adapter.id,
    startedAt,
    finishedAt: (io.now?.() ?? new Date()).toISOString(),
    ...result,
  };
}

/**
 * Runs an admitted plan and reports what happened. Execution stops at the
 * first failing step: a plan is a sequence, and continuing past a failure
 * would produce a report about a state nobody intended.
 */
export async function executePlan(plan: SignedExecutionPlan, io: ExecutionIo): Promise<ExecutionReport> {
  const startedAt = (io.now?.() ?? new Date()).toISOString();
  const before = await takeSnapshot(io.nodeId, io.root);
  const steps: StepResult[] = [];

  for (const step of plan.steps) {
    const result = await runStep(step, io);
    steps.push(result);
    if (result.exitCode !== 0) break;
  }

  const after = await takeSnapshot(io.nodeId, io.root);
  const state = observedStateFrom(plan, steps, before.freeVramGb, after.freeVramGb, after.residentModels.map((m) => m.modelId));

  const expectedModel = plan.steps.map((s) => s.params.model).find((m): m is string => typeof m === "string");

  return buildReport({
    planId: plan.planId,
    nodeId: io.nodeId,
    startedAt,
    finishedAt: (io.now?.() ?? new Date()).toISOString(),
    steps,
    checks: evaluateChecks(state, expectedModel),
  });
}

/**
 * Collects what the steps actually showed.
 *
 * A field stays undefined unless the step that would establish it really ran
 * and succeeded — otherwise a check would pass vacuously. "Nothing is
 * resident" is only evidence of an unload if an unload was attempted; on a
 * plan that stopped at its first step it means nothing at all.
 */
function observedStateFrom(
  plan: SignedExecutionPlan,
  steps: StepResult[],
  freeVramBeforeGb: number,
  freeVramAfterGb: number,
  residentModels: string[],
): ObservedState {
  const state: ObservedState = {};
  let stopped = false;

  for (const [index, step] of plan.steps.entries()) {
    const result = steps[index];
    if (!result || result.exitCode !== 0) continue;

    if (step.kind === "pull-approved-model" && typeof step.params.model === "string") {
      state.availableModels = [...(state.availableModels ?? []), step.params.model];
    }
    if (step.kind === "verify-approved-capability" && step.params.check === "inference") {
      state.inferenceOutput = result.output;
    }
    if (step.kind === "stop-managed-runtime") stopped = true;
  }

  if (stopped) {
    state.residentModels = residentModels;
    state.freeVramBeforeGb = freeVramBeforeGb;
    state.freeVramAfterGb = freeVramAfterGb;
  }
  return state;
}
