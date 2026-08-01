import type { RunnerStep, SignedExecutionPlan } from "../schema/homelab";
import { signPlan } from "./signing";

/**
 * The provable vertical slice (plan §24, Etappe 7):
 *
 *   Ollama erkennen oder genehmigt installieren
 *   → kleines genehmigtes Modell laden
 *   → Testinferenz
 *   → Healthcheck
 *   → Modell stoppen
 *   → Modell entladen
 *   → Ressourcenfreigabe belegen
 *
 * Assembled here so the sequence exists once, is signed once, and can be
 * checked against a runner's refusals rather than typed out per attempt. The
 * runner still admits every step on its own terms — this builder grants
 * nothing.
 */

/** Deliberately small: the slice is about proving the path, not the model. */
export const SLICE_MODEL = "qwen2.5-coder:1.5b";

export interface SlicePlanInput {
  nodeId: string;
  model?: string;
  /** Set when Ollama is not installed yet and the node allows installing. */
  installRuntime?: boolean;
  planId?: string;
  nonce?: string;
  issuedAt?: Date;
  ttlSeconds?: number;
}

const OLLAMA = { adapterId: "ollama", adapterVersion: "1.0.0" } as const;

export function buildVerticalSliceSteps(input: SlicePlanInput): RunnerStep[] {
  const model = input.model ?? SLICE_MODEL;
  const steps: RunnerStep[] = [];

  if (input.installRuntime) {
    steps.push({ ...OLLAMA, kind: "install-approved-runtime", params: { runtime: "ollama" } });
  }

  steps.push(
    { ...OLLAMA, kind: "pull-approved-model", params: { runtime: "ollama", model } },
    { ...OLLAMA, kind: "verify-approved-capability", params: { runtime: "ollama", model, check: "models" } },
    { ...OLLAMA, kind: "verify-approved-capability", params: { runtime: "ollama", model, check: "inference" } },
    { ...OLLAMA, kind: "stop-managed-runtime", params: { runtime: "ollama" } },
    { ...OLLAMA, kind: "verify-approved-capability", params: { runtime: "ollama", model, check: "unloaded" } },
  );

  return steps;
}

export function buildVerticalSlicePlan(input: SlicePlanInput): Omit<SignedExecutionPlan, "signature"> {
  const issuedAt = input.issuedAt ?? new Date();
  const ttl = (input.ttlSeconds ?? 900) * 1000;

  return {
    planId: input.planId ?? `slice-${issuedAt.getTime()}`,
    nodeId: input.nodeId,
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + ttl).toISOString(),
    nonce: input.nonce ?? `${issuedAt.getTime()}-${Math.random().toString(36).slice(2, 10)}`,
    steps: buildVerticalSliceSteps(input),
    artifactHashes: [],
    signerKeyId: "alfret",
  };
}

export function signVerticalSlicePlan(
  input: SlicePlanInput,
  privateKey: string,
): Promise<SignedExecutionPlan> {
  return signPlan(buildVerticalSlicePlan(input), privateKey);
}
