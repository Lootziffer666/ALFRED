import { signedExecutionPlanSchema, type RunnerStep, type SignedExecutionPlan } from "../../lib/schema/homelab";
import { verifySignature } from "../../lib/homelab/signing";
import type { AdapterRegistry } from "./adapters";

/**
 * The gate every plan passes before a single step is interpreted (plan §17.2
 * and §17.4).
 *
 * The order matters: a plan is not parsed for meaning until it is known to
 * come from the paired instance, to be meant for this machine, to be current,
 * and not to have been seen before. Only then are its steps looked at, and
 * only against the adapters this runner actually ships.
 *
 * The last word belongs to the machine itself: a perfectly valid, correctly
 * signed plan can still be refused by local policy.
 */

export type RejectionCode =
  | "malformed"
  | "not-paired"
  | "bad-signature"
  | "wrong-node"
  | "expired"
  | "not-yet-valid"
  | "replayed"
  | "unknown-step"
  | "unknown-adapter"
  | "adapter-version"
  | "bad-params"
  | "artifact-mismatch"
  | "policy-refused";

export interface PlanRejection {
  code: RejectionCode;
  message: string;
}

export type PlanVerdict =
  | { ok: true; plan: SignedExecutionPlan }
  | { ok: false; rejection: PlanRejection };

/** Rules the machine's owner set locally. They outrank any incoming plan. */
export interface LocalNodePolicy {
  /** May anything be installed here at all? */
  allowInstall: boolean;
  /** Adapters this machine accepts, even if the runner ships more. */
  allowedAdapters: string[];
  /** Step kinds refused outright, whatever a plan says. */
  refusedKinds: string[];
  /** Largest artifact this machine will pull, in gigabytes. */
  maxArtifactGb?: number;
}

export const READ_ONLY_POLICY: LocalNodePolicy = {
  allowInstall: false,
  allowedAdapters: ["probe"],
  refusedKinds: [],
};

/**
 * Time is passed in rather than read here. The guard already has a clock, and
 * a store that consulted its own would sweep against a different "now" than
 * the one that admitted the plan.
 */
export interface NonceStore {
  has(nonce: string, now: number): boolean;
  remember(nonce: string, expiresAt: number): void;
}

/** Remembers nonces until their plan would have expired anyway. */
export class MemoryNonceStore implements NonceStore {
  private readonly seen = new Map<string, number>();

  has(nonce: string, now: number): boolean {
    this.sweep(now);
    return this.seen.has(nonce);
  }

  remember(nonce: string, expiresAt: number): void {
    this.seen.set(nonce, expiresAt);
  }

  private sweep(now: number): void {
    for (const [nonce, expiresAt] of this.seen) if (expiresAt < now) this.seen.delete(nonce);
  }

  get size(): number {
    return this.seen.size;
  }
}

export interface GuardContext {
  nodeId: string;
  /** The public key stored at pairing. Null means this runner is unpaired. */
  authorizedPublicKey: string | null;
  adapters: AdapterRegistry;
  policy: LocalNodePolicy;
  nonces: NonceStore;
  now?: () => Date;
}

const INSTALLING_KINDS = new Set([
  "install-approved-runtime",
  "update-approved-runtime",
  "install-approved-toolchain",
  "pull-approved-model",
  "update-runner",
]);

function reject(code: RejectionCode, message: string): PlanVerdict {
  return { ok: false, rejection: { code, message } };
}

function checkStep(step: RunnerStep, ctx: GuardContext): PlanRejection | null {
  const adapter = ctx.adapters.get(step.adapterId);
  if (!adapter) {
    return {
      code: "unknown-adapter",
      message: `Adapter „${step.adapterId}" ist auf diesem Node nicht installiert. Pläne bringen keinen Code mit.`,
    };
  }
  if (adapter.version !== step.adapterVersion) {
    return {
      code: "adapter-version",
      message: `Adapter ${adapter.id} liegt als ${adapter.version} vor, der Plan verlangt ${step.adapterVersion}.`,
    };
  }
  if (!adapter.kinds.includes(step.kind)) {
    return { code: "unknown-step", message: `Adapter ${adapter.id} führt „${step.kind}" nicht aus.` };
  }
  if (!ctx.policy.allowedAdapters.includes(adapter.id)) {
    return { code: "policy-refused", message: `Dieser Node lässt den Adapter „${adapter.id}" nicht zu.` };
  }
  if (ctx.policy.refusedKinds.includes(step.kind)) {
    return { code: "policy-refused", message: `Dieser Node lehnt „${step.kind}" grundsätzlich ab.` };
  }
  if (INSTALLING_KINDS.has(step.kind) && !ctx.policy.allowInstall) {
    return { code: "policy-refused", message: `Dieser Node darf nichts installieren („${step.kind}").` };
  }

  const invalid = adapter.validate(step);
  if (invalid) return { code: "bad-params", message: `Parameter für „${step.kind}" abgelehnt: ${invalid}` };

  if (step.artifactHash && !/^sha256:[0-9a-f]{64}$/i.test(step.artifactHash)) {
    return { code: "artifact-mismatch", message: "Artifact-Hash ist kein sha256-Digest." };
  }
  return null;
}

/**
 * Verifies a plan and, on success, burns its nonce so the same plan cannot be
 * replayed. Returns the parsed plan; it never executes anything.
 */
export async function admitPlan(input: unknown, ctx: GuardContext): Promise<PlanVerdict> {
  const now = (ctx.now?.() ?? new Date()).getTime();

  const parsed = signedExecutionPlanSchema.safeParse(input);
  if (!parsed.success) return reject("malformed", "Plan entspricht nicht dem ExecutionPlan-Schema.");
  const plan = parsed.data;

  if (!ctx.authorizedPublicKey) {
    return reject("not-paired", "Dieser Runner ist nicht gepairt und nimmt keine Pläne an.");
  }
  if (!(await verifySignature(plan, ctx.authorizedPublicKey))) {
    return reject("bad-signature", "Signatur stammt nicht von der gepairten ALFRET-Instanz.");
  }
  if (plan.nodeId !== ctx.nodeId) {
    return reject("wrong-node", `Plan ist für ${plan.nodeId} bestimmt, dieser Node ist ${ctx.nodeId}.`);
  }

  const expiresAt = Date.parse(plan.expiresAt);
  const issuedAt = Date.parse(plan.issuedAt);
  if (Number.isNaN(expiresAt) || Number.isNaN(issuedAt)) {
    return reject("malformed", "Plan trägt keine lesbaren Zeitstempel.");
  }
  if (expiresAt <= now) return reject("expired", "Plan ist abgelaufen.");
  if (issuedAt > now + 60_000) return reject("not-yet-valid", "Plan ist auf die Zukunft datiert.");

  if (ctx.nonces.has(plan.nonce, now)) {
    return reject("replayed", "Diese Nonce wurde bereits verwendet.");
  }

  for (const step of plan.steps) {
    const rejection = checkStep(step, ctx);
    if (rejection) return { ok: false, rejection };
  }

  ctx.nonces.remember(plan.nonce, expiresAt);
  return { ok: true, plan };
}
