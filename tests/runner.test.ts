import { describe, it, expect, beforeEach } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  canonicalize,
  fingerprint,
  generateKeyPair,
  generatePairingCode,
  signPlan,
  verifySignature,
  type ExportedKeyPair,
} from "@/lib/homelab/signing";
import {
  MemoryNonceStore,
  READ_ONLY_POLICY,
  admitPlan,
  type GuardContext,
  type LocalNodePolicy,
} from "@/runner/src/guard";
import {
  INSTALLERS,
  VERIFICATION_PROMPT,
  readOnlyRegistry,
  verticalSliceRegistry,
} from "@/runner/src/adapters";
import { SLICE_MODEL, buildVerticalSlicePlan, buildVerticalSliceSteps } from "@/lib/homelab/slice";
import { beginPairing, completePairing, UNPAIRED, type PairingState } from "@/runner/src/identity";
import { buildBootstrap } from "@/lib/homelab/bootstrap";
import { buildReport, evaluateChecks, overallVerdict } from "@/lib/homelab/verify";
import type { RunnerStep, SignedExecutionPlan, StepResult } from "@/lib/schema/homelab";

const NODE_ID = "workstation-ab12";
const NOW = new Date("2026-07-31T12:00:00.000Z");

let keys: ExportedKeyPair;
let other: ExportedKeyPair;

beforeEach(async () => {
  keys ??= await generateKeyPair();
  other ??= await generateKeyPair();
});

const OLLAMA_STEP = { adapterId: "ollama", adapterVersion: "1.0.0" } as const;

const probeStep: RunnerStep = {
  kind: "probe-node",
  adapterId: "probe",
  adapterVersion: "1.0.0",
  params: {},
};

function planFor(steps: RunnerStep[], overrides: Partial<SignedExecutionPlan> = {}) {
  return {
    planId: `plan-${Math.random().toString(36).slice(2)}`,
    nodeId: NODE_ID,
    issuedAt: NOW.toISOString(),
    expiresAt: new Date(NOW.getTime() + 300_000).toISOString(),
    nonce: `nonce-${Math.random().toString(36).slice(2)}`,
    steps,
    artifactHashes: [],
    signerKeyId: "alfret",
    ...overrides,
  };
}

async function signed(steps: RunnerStep[], overrides: Partial<SignedExecutionPlan> = {}, key = keys.privateKey) {
  return signPlan(planFor(steps, overrides), key);
}

function ctx(overrides: Partial<GuardContext> = {}): GuardContext {
  return {
    nodeId: NODE_ID,
    authorizedPublicKey: keys.publicKey,
    adapters: readOnlyRegistry(),
    policy: READ_ONLY_POLICY,
    nonces: new MemoryNonceStore(),
    now: () => NOW,
    ...overrides,
  };
}

describe("canonical serialisation", () => {
  it("does not let key order change what was signed", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
    expect(canonicalize({ a: { d: 1, c: [3, { f: 1, e: 2 }] } })).toBe('{"a":{"c":[3,{"e":2,"f":1}],"d":1}}');
  });

  it("distinguishes values that merely look similar", () => {
    expect(canonicalize({ a: "1" })).not.toBe(canonicalize({ a: 1 }));
    expect(canonicalize([1, 2])).not.toBe(canonicalize([2, 1]));
  });

  it("drops undefined instead of emitting it", () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}');
  });
});

describe("signing", () => {
  it("verifies a plan it signed", async () => {
    const plan = await signed([probeStep]);
    expect(await verifySignature(plan, keys.publicKey)).toBe(true);
  });

  it("rejects a plan signed by anybody else", async () => {
    const plan = await signed([probeStep], {}, other.privateKey);
    expect(await verifySignature(plan, keys.publicKey)).toBe(false);
  });

  it("rejects a plan whose contents changed after signing", async () => {
    const plan = await signed([probeStep]);
    expect(await verifySignature({ ...plan, nodeId: "somebody-else" }, keys.publicKey)).toBe(false);
    expect(await verifySignature({ ...plan, expiresAt: "2099-01-01T00:00:00.000Z" }, keys.publicKey)).toBe(false);
  });

  it("produces a fingerprint a person can read out and compare", async () => {
    const print = await fingerprint(keys.publicKey);
    expect(print).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){3}$/);
    expect(await fingerprint(keys.publicKey)).toBe(print);
    expect(await fingerprint(other.publicKey)).not.toBe(print);
  });

  it("makes pairing codes without ambiguous characters", () => {
    for (let i = 0; i < 40; i++) expect(generatePairingCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
  });
});

describe("plan admission", () => {
  it("accepts a correctly signed, current plan for this node", async () => {
    const verdict = await admitPlan(await signed([probeStep]), ctx());
    expect(verdict.ok).toBe(true);
  });

  it("takes no plan at all while unpaired", async () => {
    const verdict = await admitPlan(await signed([probeStep]), ctx({ authorizedPublicKey: null }));
    expect(verdict).toMatchObject({ ok: false, rejection: { code: "not-paired" } });
  });

  it("refuses a plan signed by another instance", async () => {
    const verdict = await admitPlan(await signed([probeStep], {}, other.privateKey), ctx());
    expect(verdict).toMatchObject({ ok: false, rejection: { code: "bad-signature" } });
  });

  it("refuses a plan meant for a different node", async () => {
    const verdict = await admitPlan(await signed([probeStep], { nodeId: "laptop-99" }), ctx());
    expect(verdict).toMatchObject({ ok: false, rejection: { code: "wrong-node" } });
  });

  it("refuses an expired plan and one dated into the future", async () => {
    const expired = await signed([probeStep], { expiresAt: new Date(NOW.getTime() - 1000).toISOString() });
    expect(await admitPlan(expired, ctx())).toMatchObject({ ok: false, rejection: { code: "expired" } });

    const future = await signed([probeStep], {
      issuedAt: new Date(NOW.getTime() + 3_600_000).toISOString(),
      expiresAt: new Date(NOW.getTime() + 7_200_000).toISOString(),
    });
    expect(await admitPlan(future, ctx())).toMatchObject({ ok: false, rejection: { code: "not-yet-valid" } });
  });

  it("refuses the same plan a second time", async () => {
    const context = ctx();
    const plan = await signed([probeStep]);

    expect((await admitPlan(plan, context)).ok).toBe(true);
    expect(await admitPlan(plan, context)).toMatchObject({ ok: false, rejection: { code: "replayed" } });
  });

  it("refuses a step whose adapter this runner does not ship", async () => {
    const plan = await signed([{ ...probeStep, adapterId: "ollama" }]);
    expect(await admitPlan(plan, ctx())).toMatchObject({ ok: false, rejection: { code: "unknown-adapter" } });
  });

  it("refuses an adapter version it does not have", async () => {
    const plan = await signed([{ ...probeStep, adapterVersion: "9.9.9" }]);
    expect(await admitPlan(plan, ctx())).toMatchObject({ ok: false, rejection: { code: "adapter-version" } });
  });

  it("refuses a step kind the adapter cannot perform", async () => {
    const plan = await signed([{ ...probeStep, kind: "pull-approved-model", params: { runtime: "ollama", model: "x" } }]);
    expect(await admitPlan(plan, ctx())).toMatchObject({ ok: false, rejection: { code: "unknown-step" } });
  });

  it("refuses parameters that were never part of the contract", async () => {
    const plan = await signed([{ ...probeStep, params: { command: "rm -rf /" } }]);
    expect(await admitPlan(plan, ctx())).toMatchObject({ ok: false, rejection: { code: "bad-params" } });
  });

  it("refuses anything that is not a plan", async () => {
    expect(await admitPlan({ hello: "there" }, ctx())).toMatchObject({ ok: false, rejection: { code: "malformed" } });
    expect(await admitPlan("a string", ctx())).toMatchObject({ ok: false, rejection: { code: "malformed" } });
  });

  it("lets local policy refuse a plan that is otherwise perfectly valid", async () => {
    const policy: LocalNodePolicy = { ...READ_ONLY_POLICY, refusedKinds: ["probe-node"] };
    const verdict = await admitPlan(await signed([probeStep]), ctx({ policy }));
    expect(verdict).toMatchObject({ ok: false, rejection: { code: "policy-refused" } });
  });

  it("keeps installation behind a decision made on the machine itself", async () => {
    const install: RunnerStep = {
      kind: "pull-approved-model",
      adapterId: "ollama",
      adapterVersion: "1.0.0",
      params: { runtime: "ollama", model: "qwen2.5-coder:3b" },
    };
    const adapters = verticalSliceRegistry();

    const refusing: LocalNodePolicy = { allowInstall: false, allowedAdapters: adapters.ids(), refusedKinds: [] };
    expect(await admitPlan(await signed([install]), ctx({ adapters, policy: refusing }))).toMatchObject({
      ok: false,
      rejection: { code: "policy-refused" },
    });

    const allowing: LocalNodePolicy = { allowInstall: true, allowedAdapters: adapters.ids(), refusedKinds: [] };
    expect((await admitPlan(await signed([install]), ctx({ adapters, policy: allowing }))).ok).toBe(true);
  });

  it("does not burn the nonce of a plan it rejected", async () => {
    const context = ctx();
    await admitPlan(await signed([probeStep], {}, other.privateKey), context);
    expect((context.nonces as MemoryNonceStore).size).toBe(0);
  });
});

describe("adapters carry no commands from the wire", () => {
  const registry = verticalSliceRegistry();

  it("rejects a model name that tries to be something else", () => {
    const ollama = registry.get("ollama")!;
    for (const model of ["a; rm -rf /", "$(whoami)", "../../etc/passwd", "a b", "`id`", ""]) {
      const step: RunnerStep = {
        kind: "pull-approved-model",
        adapterId: "ollama",
        adapterVersion: "1.0.0",
        params: { runtime: "ollama", model },
      };
      expect(ollama.validate(step), `"${model}" must be refused`).not.toBeNull();
    }
  });

  it("builds an argument vector, never a shell string", () => {
    const ollama = registry.get("ollama")!;
    const command = ollama.command({
      kind: "pull-approved-model",
      adapterId: "ollama",
      adapterVersion: "1.0.0",
      params: { runtime: "ollama", model: "qwen2.5-coder:3b" },
    })!;
    expect(command.argv).toEqual(["ollama", "pull", "qwen2.5-coder:3b"]);
    expect(command.argv.some((a) => /[;&|`$]/.test(a))).toBe(false);
  });

  it("ships nothing that changes the machine while reading only", () => {
    expect(readOnlyRegistry().supportedKinds()).toEqual(["probe-node"]);
  });

  it("never spawns a shell in the runner's own source", () => {
    const dir = path.resolve(__dirname, "../runner/src");
    for (const file of readdirSync(dir)) {
      const source = readFileSync(path.join(dir, file), "utf8");
      expect(source, `${file} must not use exec() or spawn with a shell`).not.toMatch(
        /\bexecSync\b|\bexec\s*\(|shell\s*:\s*true/,
      );
    }
  });
});

describe("pairing", () => {
  let state: PairingState;

  beforeEach(() => {
    const { code, until } = beginPairing(NOW);
    state = { ...UNPAIRED, pendingCode: code, pendingUntil: until };
  });

  it("pairs with the right code and returns the fingerprint to compare", async () => {
    const result = await completePairing(state, { code: state.pendingCode!, publicKey: keys.publicKey }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.authorizedPublicKey).toBe(keys.publicKey);
    expect(result.fingerprint).toBe(await fingerprint(keys.publicKey));
    // The window closes behind it.
    expect(result.state.pendingCode).toBeNull();
  });

  it("refuses a wrong code, an expired one, and a closed window", async () => {
    expect(await completePairing(state, { code: "WRONG", publicKey: keys.publicKey }, NOW)).toMatchObject({
      ok: false,
    });

    const late = new Date(NOW.getTime() + 3_600_000);
    expect(await completePairing(state, { code: state.pendingCode!, publicKey: keys.publicKey }, late)).toMatchObject({
      ok: false,
    });

    expect(await completePairing(UNPAIRED, { code: "ANY12", publicKey: keys.publicKey }, NOW)).toMatchObject({
      ok: false,
    });
  });

  it("answers to one instance only", async () => {
    const paired = await completePairing(state, { code: state.pendingCode!, publicKey: keys.publicKey }, NOW);
    expect(paired.ok).toBe(true);
    if (!paired.ok) return;

    const second = await completePairing(paired.state, { code: "ANY12", publicKey: other.publicKey }, NOW);
    expect(second).toMatchObject({ ok: false });
    if (second.ok) return;
    expect(second.reason).toMatch(/bereits gepairt/);
  });
});

describe("bootstrap packages", () => {
  it("writes one command per platform and never pipes a download into a shell", () => {
    for (const os of ["linux", "windows", "android"] as const) {
      const pkg = buildBootstrap({ os });
      expect(pkg.command).toBeTruthy();
      expect(pkg.script).not.toMatch(/curl[^|]*\|\s*(sh|bash)/);
      expect(pkg.script).not.toMatch(/wget[^|]*\|\s*(sh|bash)/);
      expect(pkg.notes.join(" ")).toMatch(/lädt bewusst nichts nach/);
    }
  });

  it("binds to loopback and says how the node is reached from outside", () => {
    const pkg = buildBootstrap({ os: "linux" });
    expect(pkg.notes.join(" ")).toMatch(/127\.0\.0\.1:7717/);
    expect(pkg.notes.join(" ")).toMatch(/Tailscale/);
  });

  it("states that installing stays a decision made on the machine", () => {
    for (const os of ["linux", "windows", "android"] as const) {
      expect(buildBootstrap({ os }).notes.join(" ")).toMatch(/--allow-install/);
    }
  });

  it("gives Termux its own script and its own advice", () => {
    const termux = buildBootstrap({ os: "android" });
    expect(termux.filename).toContain("termux");
    expect(termux.notes.join(" ")).toMatch(/termux-services/);
  });
});

describe("verification", () => {
  const step = (exitCode: number | null): StepResult => ({
    kind: "pull-approved-model",
    adapterId: "ollama",
    startedAt: NOW.toISOString(),
    finishedAt: NOW.toISOString(),
    exitCode,
    output: "",
  });

  it("treats an unobserved check as unproven, not as passed", () => {
    const checks = evaluateChecks({});
    expect(checks.every((c) => c.verdict === "not_proven")).toBe(true);
    expect(overallVerdict(checks)).toBe("not_proven");
  });

  it("passes only what it actually saw", () => {
    const checks = evaluateChecks(
      {
        availableModels: ["qwen2.5-coder:3b"],
        inferenceOutput: "Hallo.",
        residentModels: [],
        freeVramBeforeGb: 11,
        freeVramAfterGb: 11,
      },
      "qwen2.5-coder:3b",
    );
    expect(overallVerdict(checks)).toBe("passed");
  });

  it("fails when a model is still resident after the stop", () => {
    const checks = evaluateChecks(
      { availableModels: ["m"], inferenceOutput: "ok", residentModels: ["m"], freeVramBeforeGb: 11, freeVramAfterGb: 3 },
      "m",
    );
    expect(checks.find((c) => c.id === "model-unloaded")!.verdict).toBe("failed");
    expect(overallVerdict(checks)).toBe("failed");
  });

  it("never reports a passing run when a step failed, whatever the checks say", () => {
    const checks = evaluateChecks(
      { availableModels: ["m"], inferenceOutput: "ok", residentModels: [], freeVramBeforeGb: 11, freeVramAfterGb: 11 },
      "m",
    );
    expect(overallVerdict(checks)).toBe("passed");

    const report = buildReport({
      planId: "p",
      nodeId: NODE_ID,
      startedAt: NOW.toISOString(),
      finishedAt: NOW.toISOString(),
      steps: [step(1)],
      checks,
    });
    expect(report.verdict).toBe("failed");
  });

  it("does not turn an exit code of zero into proof on its own", () => {
    const report = buildReport({
      planId: "p",
      nodeId: NODE_ID,
      startedAt: NOW.toISOString(),
      finishedAt: NOW.toISOString(),
      steps: [step(0)],
      checks: evaluateChecks({}),
    });
    expect(report.verdict).toBe("not_proven");
  });
});

describe("no command this runner builds involves a shell", () => {
  const SHELLS = ["sh", "bash", "zsh", "dash", "cmd", "cmd.exe", "powershell", "pwsh", "wsl"];
  const registry = verticalSliceRegistry();

  it("never puts a shell at the head of an argument vector", () => {
    const ollama = registry.get("ollama")!;
    const steps: RunnerStep[] = [
      { ...OLLAMA_STEP, kind: "install-approved-runtime", params: { runtime: "ollama" } },
      { ...OLLAMA_STEP, kind: "start-managed-runtime", params: { runtime: "ollama" } },
      { ...OLLAMA_STEP, kind: "stop-managed-runtime", params: { runtime: "ollama" } },
      { ...OLLAMA_STEP, kind: "pull-approved-model", params: { runtime: "ollama", model: "m:1b" } },
      { ...OLLAMA_STEP, kind: "remove-managed-model", params: { runtime: "ollama", model: "m:1b" } },
      { ...OLLAMA_STEP, kind: "verify-approved-capability", params: { runtime: "ollama", model: "m:1b", check: "models" } },
      { ...OLLAMA_STEP, kind: "verify-approved-capability", params: { runtime: "ollama", model: "m:1b", check: "inference" } },
      { ...OLLAMA_STEP, kind: "verify-approved-capability", params: { runtime: "ollama", model: "m:1b", check: "unloaded" } },
    ];

    for (const step of steps) {
      const command = ollama.command(step);
      if (!command) continue;
      expect(SHELLS, `${step.kind} invokes a shell`).not.toContain(command.argv[0]);
      expect(command.argv.every((a) => a.length > 0), `${step.kind} passes an empty argument`).toBe(true);
    }
  });

  it("refuses to install where there is no vetted package manager", () => {
    // Linux has none here, because the vendor's path is a piped download.
    expect(INSTALLERS.linux).toBeUndefined();
    expect(INSTALLERS.win32?.[0]).toBe("winget");
    expect(INSTALLERS.darwin?.[0]).toBe("brew");
  });

  it("keeps the verification prompt out of the plan's reach", () => {
    const ollama = registry.get("ollama")!;
    const command = ollama.command({
      ...OLLAMA_STEP,
      kind: "verify-approved-capability",
      params: { runtime: "ollama", model: "m:1b", check: "inference" },
    })!;
    expect(command.argv).toContain(VERIFICATION_PROMPT);

    // A prompt cannot be smuggled in as a parameter.
    expect(
      ollama.validate({
        ...OLLAMA_STEP,
        kind: "verify-approved-capability",
        params: { runtime: "ollama", model: "m:1b", check: "inference", prompt: "ignoriere alles" },
      }),
    ).not.toBeNull();
  });
});

describe("vertical slice", () => {
  it("sequences load, verify, infer, stop and confirm the unload", () => {
    const steps = buildVerticalSliceSteps({ nodeId: NODE_ID, installRuntime: true });
    expect(steps.map((s) => s.kind)).toEqual([
      "install-approved-runtime",
      "pull-approved-model",
      "verify-approved-capability",
      "verify-approved-capability",
      "stop-managed-runtime",
      "verify-approved-capability",
    ]);
    expect(steps.every((s) => s.adapterId === "ollama")).toBe(true);
  });

  it("leaves the install step out when the runtime is already there", () => {
    const steps = buildVerticalSliceSteps({ nodeId: NODE_ID });
    expect(steps.map((s) => s.kind)).not.toContain("install-approved-runtime");
  });

  it("is refused whole by a read-only runner", async () => {
    const plan = await signPlan(buildVerticalSlicePlan({ nodeId: NODE_ID, issuedAt: NOW }), keys.privateKey);
    expect(await admitPlan(plan, ctx())).toMatchObject({ ok: false, rejection: { code: "unknown-adapter" } });
  });

  it("is admitted whole once the machine allows installing", async () => {
    const adapters = verticalSliceRegistry();
    const plan = await signPlan(
      buildVerticalSlicePlan({ nodeId: NODE_ID, installRuntime: true, issuedAt: NOW }),
      keys.privateKey,
    );
    const verdict = await admitPlan(
      plan,
      ctx({ adapters, policy: { allowInstall: true, allowedAdapters: adapters.ids(), refusedKinds: [] } }),
    );
    expect(verdict.ok).toBe(true);
  });

  it("uses a model small enough to be a proof rather than a benchmark", () => {
    expect(SLICE_MODEL).toMatch(/1\.5b|:1b|3b/);
  });
});
