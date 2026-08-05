import { describe, it, expect } from "vitest";
import {
  LLAMACPP_ADAPTER,
  LLAMACPP_MODEL_DIR,
  PROBE_ADAPTER,
  TERMUX_ADAPTER,
  VLLM_ADAPTER,
  VERIFICATION_PROMPT_LLAMACPP,
  allowedAdapterIds,
  fullRegistry,
  llamaCppRegistry,
  refusedKindsForTrust,
  termuxRegistry,
  verticalSliceRegistry,
  vllmRegistry,
} from "@/runner/src/adapters";

// ── Helpers ──────────────────────────────────────────────────────────────────

function step(
  adapterId: string,
  adapterVersion: string,
  kind: string,
  params: Record<string, string | number | boolean> = {},
) {
  return { adapterId, adapterVersion, kind, params } as Parameters<typeof PROBE_ADAPTER.validate>[0];
}

// ── Probe ─────────────────────────────────────────────────────────────────────

describe("probe adapter", () => {
  it("validates probe-node with empty params", () => {
    expect(PROBE_ADAPTER.validate(step("probe", "1.0.0", "probe-node"))).toBeNull();
  });

  it("rejects probe-node with unexpected params", () => {
    expect(PROBE_ADAPTER.validate(step("probe", "1.0.0", "probe-node", { extra: "x" }))).not.toBeNull();
  });

  it("returns no command — probe runs in-process", () => {
    expect(PROBE_ADAPTER.command(step("probe", "1.0.0", "probe-node"))).toBeNull();
  });

});

// ── llama.cpp (8a) ────────────────────────────────────────────────────────────

describe("llama.cpp adapter — validation", () => {
  const ok = {
    install:  step("llama.cpp", "1.0.0", "install-approved-runtime", { runtime: "llama.cpp" }),
    pull:     step("llama.cpp", "1.0.0", "pull-approved-model",      { runtime: "llama.cpp", model: "qwen2.5-7b-q4", repoId: "Qwen/Qwen2.5-7B-Instruct-GGUF", filename: "qwen2.5-7b-instruct-q4_k_m.gguf" }),
    start:    step("llama.cpp", "1.0.0", "start-managed-runtime",    { runtime: "llama.cpp", model: "qwen2.5-7b-q4", port: 8080, ctxSize: 8192, ngl: 30 }),
    stop:     step("llama.cpp", "1.0.0", "stop-managed-runtime",     { runtime: "llama.cpp" }),
    remove:   step("llama.cpp", "1.0.0", "remove-managed-model",     { runtime: "llama.cpp", model: "qwen2.5-7b-q4" }),
    verifyBin:step("llama.cpp", "1.0.0", "verify-approved-capability",{ runtime: "llama.cpp", model: "qwen2.5-7b-q4", check: "binary" }),
    verifyInf:step("llama.cpp", "1.0.0", "verify-approved-capability",{ runtime: "llama.cpp", model: "qwen2.5-7b-q4", check: "inference" }),
    verifyUnl:step("llama.cpp", "1.0.0", "verify-approved-capability",{ runtime: "llama.cpp", model: "qwen2.5-7b-q4", check: "unloaded" }),
  };

  for (const [name, s] of Object.entries(ok)) {
    it(`accepts a valid ${name} step`, () => expect(LLAMACPP_ADAPTER.validate(s)).toBeNull());
  }

  it("rejects pull-approved-model without repoId", () => {
    const s = step("llama.cpp", "1.0.0", "pull-approved-model", { runtime: "llama.cpp", model: "x" });
    expect(LLAMACPP_ADAPTER.validate(s)).not.toBeNull();
  });

  it("rejects start-managed-runtime with a negative port", () => {
    const s = step("llama.cpp", "1.0.0", "start-managed-runtime", { runtime: "llama.cpp", model: "x", repoId: "r", filename: "f", port: -1 });
    expect(LLAMACPP_ADAPTER.validate(s)).not.toBeNull();
  });

  it("rejects an unknown runtime value", () => {
    const s = step("llama.cpp", "1.0.0", "install-approved-runtime", { runtime: "ollama" });
    expect(LLAMACPP_ADAPTER.validate(s)).not.toBeNull();
  });

  it("rejects a kind this adapter does not handle", () => {
    const s = step("llama.cpp", "1.0.0", "update-runner", {});
    expect(LLAMACPP_ADAPTER.validate(s)).not.toBeNull();
  });

});

describe("llama.cpp adapter — commands", () => {
  it("installs via pip, no shell", () => {
    const cmd = LLAMACPP_ADAPTER.command(
      step("llama.cpp", "1.0.0", "install-approved-runtime", { runtime: "llama.cpp" })
    )!;
    expect(cmd.argv[0]).toBe("pip");
    expect(cmd.argv).toContain("llama-cpp-python[server]");
    expect(cmd.argv.join(" ")).not.toMatch(/[;&|`$]/);
  });

  it("pulls a model with huggingface-cli, placing it in the model dir", () => {
    const cmd = LLAMACPP_ADAPTER.command(
      step("llama.cpp", "1.0.0", "pull-approved-model", { runtime: "llama.cpp", model: "q", repoId: "Org/Repo", filename: "q.gguf" })
    )!;
    expect(cmd.argv[0]).toBe("huggingface-cli");
    expect(cmd.argv).toContain("Org/Repo");
    expect(cmd.argv).toContain("q.gguf");
    expect(cmd.argv).toContain(LLAMACPP_MODEL_DIR);
  });

  it("starts llama-server with explicit argv elements, no shell interpolation", () => {
    const cmd = LLAMACPP_ADAPTER.command(
      step("llama.cpp", "1.0.0", "start-managed-runtime", { runtime: "llama.cpp", model: "q", port: 9090, ctxSize: 16384, ngl: 35 })
    )!;
    expect(cmd.argv[0]).toBe("llama-server");
    expect(cmd.argv).toContain("--port");
    expect(cmd.argv).toContain("9090");
    expect(cmd.argv).toContain("--ctx-size");
    expect(cmd.argv).toContain("16384");
    expect(cmd.argv).toContain("--n-gpu-layers");
    expect(cmd.argv).toContain("35");
    expect(cmd.argv.join(" ")).not.toMatch(/[;&|`$]/);
  });

  it("stops via POST /shutdown, not via kill", () => {
    const cmd = LLAMACPP_ADAPTER.command(
      step("llama.cpp", "1.0.0", "stop-managed-runtime", { runtime: "llama.cpp" })
    )!;
    expect(cmd.argv[0]).toBe("curl");
    expect(cmd.argv.join(" ")).toContain("/shutdown");
  });

  it("verify binary checks llama-server --version", () => {
    const cmd = LLAMACPP_ADAPTER.command(
      step("llama.cpp", "1.0.0", "verify-approved-capability", { runtime: "llama.cpp", model: "q", check: "binary" })
    )!;
    expect(cmd.argv).toEqual(["llama-server", "--version"]);
  });

  it("verify inference POSTs the fixed prompt, not a user-supplied one", () => {
    const cmd = LLAMACPP_ADAPTER.command(
      step("llama.cpp", "1.0.0", "verify-approved-capability", { runtime: "llama.cpp", model: "q", check: "inference" })
    )!;
    const body = JSON.parse(cmd.argv[cmd.argv.indexOf("-d") + 1]);
    expect(body.prompt).toBe(VERIFICATION_PROMPT_LLAMACPP);
    expect(body.max_tokens).toBe(4);
  });

});

// ── vLLM (8b) ─────────────────────────────────────────────────────────────────

describe("vLLM adapter — validation", () => {
  const ok = {
    install: step("vllm", "1.0.0", "install-approved-runtime", { runtime: "vllm" }),
    pull:    step("vllm", "1.0.0", "pull-approved-model",      { runtime: "vllm", model: "Qwen/Qwen2.5-7B" }),
    create:  step("vllm", "1.0.0", "create-ephemeral-sandbox", { runtime: "vllm", model: "Qwen/Qwen2.5-7B", gpuMemoryUtilization: 0.9 }),
    destroy: step("vllm", "1.0.0", "destroy-ephemeral-sandbox",{ runtime: "vllm" }),
    remove:  step("vllm", "1.0.0", "remove-managed-model",     { runtime: "vllm", model: "Qwen/Qwen2.5-7B" }),
    health:  step("vllm", "1.0.0", "verify-approved-capability",{ runtime: "vllm", model: "Qwen/Qwen2.5-7B", check: "health" }),
    infer:   step("vllm", "1.0.0", "verify-approved-capability",{ runtime: "vllm", model: "Qwen/Qwen2.5-7B", check: "inference" }),
    unload:  step("vllm", "1.0.0", "verify-approved-capability",{ runtime: "vllm", model: "Qwen/Qwen2.5-7B", check: "unloaded" }),
  };

  for (const [name, s] of Object.entries(ok)) {
    it(`accepts a valid ${name} step`, () => expect(VLLM_ADAPTER.validate(s)).toBeNull());
  }

  it("rejects gpuMemoryUtilization above 1", () => {
    const s = step("vllm", "1.0.0", "create-ephemeral-sandbox", { runtime: "vllm", model: "x", gpuMemoryUtilization: 1.1 });
    expect(VLLM_ADAPTER.validate(s)).not.toBeNull();
  });

  it("rejects an unknown check value", () => {
    const s = step("vllm", "1.0.0", "verify-approved-capability", { runtime: "vllm", model: "x", check: "models" });
    expect(VLLM_ADAPTER.validate(s)).not.toBeNull();
  });

});

describe("vLLM adapter — commands", () => {
  it("starts vllm serve with gpu-memory-utilization and trust-remote-code", () => {
    const cmd = VLLM_ADAPTER.command(
      step("vllm", "1.0.0", "create-ephemeral-sandbox", { runtime: "vllm", model: "Qwen/Qwen2.5-7B", gpuMemoryUtilization: 0.85 })
    )!;
    expect(cmd.argv[0]).toBe("vllm");
    expect(cmd.argv[1]).toBe("serve");
    expect(cmd.argv).toContain("--gpu-memory-utilization");
    expect(cmd.argv).toContain("0.85");
    expect(cmd.argv).toContain("--trust-remote-code");
    expect(cmd.argv.join(" ")).not.toMatch(/[;&|`$]/);
  });

  it("appends --max-model-len only when provided", () => {
    const withLen = VLLM_ADAPTER.command(
      step("vllm", "1.0.0", "create-ephemeral-sandbox", { runtime: "vllm", model: "x", maxModelLen: 8192 })
    )!;
    expect(withLen.argv).toContain("--max-model-len");

    const without = VLLM_ADAPTER.command(
      step("vllm", "1.0.0", "create-ephemeral-sandbox", { runtime: "vllm", model: "x" })
    )!;
    expect(without.argv).not.toContain("--max-model-len");
  });

  it("destroy-ephemeral-sandbox returns null — executor handles SIGTERM", () => {
    expect(
      VLLM_ADAPTER.command(step("vllm", "1.0.0", "destroy-ephemeral-sandbox", { runtime: "vllm" }))
    ).toBeNull();
  });

  it("health check hits /health", () => {
    const cmd = VLLM_ADAPTER.command(
      step("vllm", "1.0.0", "verify-approved-capability", { runtime: "vllm", model: "x", check: "health" })
    )!;
    expect(cmd.argv.join(" ")).toContain("/health");
  });

});

// ── Termux (8c) ───────────────────────────────────────────────────────────────

describe("Termux adapter — validation", () => {
  const ok = {
    install: step("termux-llama.cpp", "1.0.0", "install-approved-runtime",  { runtime: "termux-llama.cpp" }),
    pull:    step("termux-llama.cpp", "1.0.0", "pull-approved-model",        { runtime: "termux-llama.cpp", model: "q", repoId: "Org/Repo", filename: "q.gguf" }),
    start:   step("termux-llama.cpp", "1.0.0", "start-managed-runtime",      { runtime: "termux-llama.cpp", model: "q", port: 8080, ctxSize: 2048 }),
    stop:    step("termux-llama.cpp", "1.0.0", "stop-managed-runtime",        { runtime: "termux-llama.cpp" }),
    remove:  step("termux-llama.cpp", "1.0.0", "remove-managed-model",        { runtime: "termux-llama.cpp", model: "q" }),
    verifyBin: step("termux-llama.cpp", "1.0.0", "verify-approved-capability",{ runtime: "termux-llama.cpp", model: "q", check: "binary" }),
    verifyInf: step("termux-llama.cpp", "1.0.0", "verify-approved-capability",{ runtime: "termux-llama.cpp", model: "q", check: "inference" }),
    verifyUnl: step("termux-llama.cpp", "1.0.0", "verify-approved-capability",{ runtime: "termux-llama.cpp", model: "q", check: "unloaded" }),
  };

  for (const [name, s] of Object.entries(ok)) {
    it(`accepts a valid ${name} step`, () => expect(TERMUX_ADAPTER.validate(s)).toBeNull());
  }

  it("rejects pull without filename", () => {
    const s = step("termux-llama.cpp", "1.0.0", "pull-approved-model", { runtime: "termux-llama.cpp", model: "q", repoId: "Org/Repo" });
    expect(TERMUX_ADAPTER.validate(s)).not.toBeNull();
  });

});

describe("Termux adapter — commands", () => {
  it("installs via pkg, Termux's own package manager", () => {
    const cmd = TERMUX_ADAPTER.command(
      step("termux-llama.cpp", "1.0.0", "install-approved-runtime", { runtime: "termux-llama.cpp" })
    )!;
    expect(cmd.argv[0]).toBe("pkg");
    expect(cmd.argv).toContain("llama.cpp");
  });

  it("starts llama-server without ngl — Android has no discrete GPU", () => {
    const cmd = TERMUX_ADAPTER.command(
      step("termux-llama.cpp", "1.0.0", "start-managed-runtime", { runtime: "termux-llama.cpp", model: "q", port: 8080, ctxSize: 2048 })
    )!;
    expect(cmd.argv[0]).toBe("llama-server");
    expect(cmd.argv.join(" ")).not.toContain("--n-gpu-layers");
  });

  it("respects a custom port in the shutdown URL", () => {
    const cmd = TERMUX_ADAPTER.command(
      step("termux-llama.cpp", "1.0.0", "stop-managed-runtime", { runtime: "termux-llama.cpp", model: "q", port: 9999 })
    )!;
    expect(cmd.argv.join(" ")).toContain(":9999/shutdown");
  });

});

// ── Policy helpers (8c) ───────────────────────────────────────────────────────

describe("allowedAdapterIds", () => {
  it("gives owned nodes all adapters", () => {
    const ids = allowedAdapterIds("owned", { mayInstall: true });
    expect(ids).toContain("ollama");
    expect(ids).toContain("llama.cpp");
    expect(ids).toContain("vllm");
    expect(ids).toContain("termux-llama.cpp");
  });

  it("restricts borrowed nodes to read-only + inference, no vLLM", () => {
    const ids = allowedAdapterIds("borrowed", { mayInstall: false });
    expect(ids).toContain("probe");
    expect(ids).toContain("llama.cpp");
    expect(ids).not.toContain("vllm");
    expect(ids).not.toContain("ollama");
  });

  it("gives rented+mayInstall only probe+vllm, nothing else persists", () => {
    const ids = allowedAdapterIds("rented", { mayInstall: true });
    expect(ids).toEqual(["probe", "vllm"]);
  });

  it("gives rented+no-install only probe", () => {
    const ids = allowedAdapterIds("rented", { mayInstall: false });
    expect(ids).toEqual(["probe"]);
  });

});

describe("refusedKindsForTrust", () => {
  it("refuses nothing for owned nodes", () => {
    expect(refusedKindsForTrust("owned")).toEqual([]);
  });

  it("always refuses update-runner and toolchain installs on non-owned", () => {
    for (const trust of ["borrowed", "rented"] as const) {
      const refused = refusedKindsForTrust(trust);
      expect(refused).toContain("update-runner");
      expect(refused).toContain("install-approved-toolchain");
    }
  });

  it("additionally refuses runtime and model ops on borrowed nodes", () => {
    const refused = refusedKindsForTrust("borrowed");
    expect(refused).toContain("install-approved-runtime");
    expect(refused).toContain("remove-approved-runtime");
    expect(refused).toContain("remove-managed-model");
  });

  it("does not refuse runtime installs for rented (that is policy, not trust)", () => {
    expect(refusedKindsForTrust("rented")).not.toContain("install-approved-runtime");
  });

});

// ── Registries ────────────────────────────────────────────────────────────────

describe("registries", () => {
  it("verticalSliceRegistry contains exactly probe + ollama", () => {
    const r = verticalSliceRegistry();
    expect(r.ids().sort()).toEqual(["ollama", "probe"]);
  });

  it("llamaCppRegistry contains exactly probe + llama.cpp", () => {
    const r = llamaCppRegistry();
    expect(r.ids().sort()).toEqual(["llama.cpp", "probe"]);
  });

  it("vllmRegistry contains exactly probe + vllm", () => {
    const r = vllmRegistry();
    expect(r.ids().sort()).toEqual(["probe", "vllm"]);
  });

  it("termuxRegistry contains exactly probe + termux-llama.cpp", () => {
    const r = termuxRegistry();
    expect(r.ids().sort()).toEqual(["probe", "termux-llama.cpp"]);
  });

  it("fullRegistry contains all five adapters", () => {
    const r = fullRegistry();
    expect(r.ids().sort()).toEqual(["llama.cpp", "ollama", "probe", "termux-llama.cpp", "vllm"]);
  });

  it("fullRegistry supports all step kinds the guard may encounter", () => {
    const kinds = fullRegistry().supportedKinds();
    expect(kinds).toContain("create-ephemeral-sandbox");
    expect(kinds).toContain("destroy-ephemeral-sandbox");
    expect(kinds).toContain("start-managed-runtime");
    expect(kinds).toContain("probe-node");
  });

});
