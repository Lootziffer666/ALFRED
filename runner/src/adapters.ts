import { z } from "zod";
import type { NodePolicy, NodeTrust, RunnerStep, RunnerStepKind } from "../../lib/schema/homelab";

/**
 * Runtime and toolchain adapters (plan §17.4).
 *
 * An adapter implements a single strategy for a step kind (e.g., ollama, llama.cpp,
 * vLLM). Each adapter describes its own validation schema and command generation.
 *
 * Adapters ship immutable — they do not persist or cache state.
 * The plan guards the output (artifact hashes) but not the execution itself.
 *
 * Etappe 8 (8a, 8b, 8c): llama.cpp, vLLM, Termux/llama.cpp backends.
 */

export interface StepAdapter {
  id: string;
  version: string;
  kinds: RunnerStepKind[];

  validate(step: RunnerStep): string | null;
  command(step: RunnerStep): { argv: string[]; timeoutSeconds: number } | null;
}

const modelName = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/, "Modellname enthält unzulässige Zeichen.");

const paramsFor = {
  "probe-node": z.object({}).strict(),

  // ── Ollama ───────────────────────────────────────────────────────────────
  "ollama:install-approved-runtime": z.object({ runtime: z.literal("ollama") }).strict(),
  "ollama:start-managed-runtime":    z.object({ runtime: z.literal("ollama") }).strict(),
  "ollama:stop-managed-runtime":     z.object({ runtime: z.literal("ollama"), model: modelName.optional() }).strict(),
  "ollama:pull-approved-model":      z.object({ runtime: z.literal("ollama"), model: modelName }).strict(),
  "ollama:remove-managed-model":     z.object({ runtime: z.literal("ollama"), model: modelName }).strict(),
  "ollama:verify-approved-capability": z
    .object({ runtime: z.literal("ollama"), model: modelName, check: z.enum(["models", "inference", "unloaded"]) })
    .strict(),

  // ── llama.cpp ─────────────────────────────────────────────────────────────
  "llamacpp:install-approved-runtime":  z.object({ runtime: z.literal("llama.cpp") }).strict(),
  "llamacpp:pull-approved-model":       z.object({ runtime: z.literal("llama.cpp"), model: modelName, repoId: z.string().min(1), filename: z.string().min(1) }).strict(),
  "llamacpp:remove-managed-model":      z.object({ runtime: z.literal("llama.cpp"), model: modelName }).strict(),
  "llamacpp:start-managed-runtime":     z.object({ runtime: z.literal("llama.cpp"), model: modelName, host: z.string().optional(), port: z.number().int().positive().optional(), ctxSize: z.number().int().positive().optional(), ngl: z.number().int().nonnegative().optional() }).strict(),
  "llamacpp:stop-managed-runtime":      z.object({ runtime: z.literal("llama.cpp") }).strict(),
  "llamacpp:verify-approved-capability": z
    .object({ runtime: z.literal("llama.cpp"), model: modelName, check: z.enum(["binary", "inference", "unloaded"]) })
    .strict(),

  // ── vLLM ─────────────────────────────────────────────────────────────────
  "vllm:install-approved-runtime":      z.object({ runtime: z.literal("vllm") }).strict(),
  "vllm:pull-approved-model":           z.object({ runtime: z.literal("vllm"), model: modelName }).strict(),
  "vllm:remove-managed-model":          z.object({ runtime: z.literal("vllm"), model: modelName }).strict(),
  "vllm:create-ephemeral-sandbox":      z.object({ runtime: z.literal("vllm"), model: modelName, gpuMemoryUtilization: z.number().min(0.1).max(1).optional(), maxModelLen: z.number().int().positive().optional() }).strict(),
  "vllm:destroy-ephemeral-sandbox":     z.object({ runtime: z.literal("vllm") }).strict(),
  "vllm:verify-approved-capability":    z
    .object({ runtime: z.literal("vllm"), model: modelName, check: z.enum(["health", "inference", "unloaded"]) })
    .strict(),

  // ── Termux / llama.cpp-Android ───────────────────────────────────────────
  "termux:install-approved-runtime":    z.object({ runtime: z.literal("termux-llama.cpp") }).strict(),
  "termux:pull-approved-model":         z.object({ runtime: z.literal("termux-llama.cpp"), model: modelName, repoId: z.string().min(1), filename: z.string().min(1) }).strict(),
  "termux:remove-managed-model":        z.object({ runtime: z.literal("termux-llama.cpp"), model: modelName }).strict(),
  "termux:start-managed-runtime":       z.object({ runtime: z.literal("termux-llama.cpp"), model: modelName, port: z.number().int().positive().optional(), ctxSize: z.number().int().positive().optional() }).strict(),
  "termux:stop-managed-runtime":        z.object({ runtime: z.literal("termux-llama.cpp") }).strict(),
  "termux:verify-approved-capability":  z
    .object({ runtime: z.literal("termux-llama.cpp"), model: modelName, check: z.enum(["binary", "inference", "unloaded"]) })
    .strict(),
} as const;

function validateWith(key: keyof typeof paramsFor, step: RunnerStep): string | null {
  const parsed = paramsFor[key].safeParse(step.params);
  return parsed.success ? null : z.prettifyError(parsed.error);
}

export const PROBE_ADAPTER: StepAdapter = {
  id: "probe",
  version: "1.0.0",
  kinds: ["probe-node"],
  validate: (step) => validateWith("probe-node", step),
  command: () => null,
};

/** Fixed, so a verification cannot smuggle in a prompt of its own. */
export const VERIFICATION_PROMPT = "Antworte mit genau einem Wort: OK";
/** Verification prompt for llama-server (OpenAI-compat /v1/completions). */
export const VERIFICATION_PROMPT_LLAMACPP = "Respond with exactly one word: OK";

/**
 * Package managers this adapter will call, by platform. Absent means the
 * platform is not supported.
 */
const INSTALLERS: Partial<Record<NodeJS.Platform, string[]>> = {
  darwin: ["brew", "install", "ollama"],
  linux: ["apt-get", "install", "-y", "ollama"],
  win32: ["choco", "install", "-y", "ollama"],
};

const OLLAMA_TIMEOUTS: Partial<Record<RunnerStepKind, number>> = {
  "install-approved-runtime": 600,
  "pull-approved-model":      3600,
  "start-managed-runtime":    120,
  "stop-managed-runtime":     30,
  "remove-managed-model":     60,
  "verify-approved-capability": 120,
};

export const OLLAMA_ADAPTER: StepAdapter = {
  id: "ollama",
  version: "1.0.0",
  kinds: [
    "install-approved-runtime",
    "start-managed-runtime",
    "stop-managed-runtime",
    "pull-approved-model",
    "remove-managed-model",
    "verify-approved-capability",
  ],
  validate: (step) => {
    if (!OLLAMA_ADAPTER.kinds.includes(step.kind)) return `Adapter ollama kann „${step.kind}" nicht.`;
    return validateWith(`ollama:${step.kind}` as keyof typeof paramsFor, step);
  },
  command: (step) => {
    const timeoutSeconds = OLLAMA_TIMEOUTS[step.kind] ?? 60;
    const model = typeof step.params.model === "string" ? step.params.model : "";
    switch (step.kind) {
      case "install-approved-runtime": {
        const installer = INSTALLERS[process.platform];
        return installer ? { argv: installer, timeoutSeconds } : null;
      }
      case "start-managed-runtime":
        return { argv: ["ollama", "serve"], timeoutSeconds };
      case "stop-managed-runtime":
        return { argv: model ? ["ollama", "stop", model] : ["ollama", "stop"], timeoutSeconds };
      case "pull-approved-model":
        return { argv: ["ollama", "pull", model], timeoutSeconds };
      case "remove-managed-model":
        return { argv: ["ollama", "rm", model], timeoutSeconds };
      case "verify-approved-capability":
        if (step.params.check === "inference") {
          return { argv: ["ollama", "run", model, VERIFICATION_PROMPT], timeoutSeconds };
        }
        return { argv: ["ollama", step.params.check === "models" ? "list" : "ps"], timeoutSeconds };
      default:
        return null;
    }
  },
};

// ── 8a: llama.cpp ─────────────────────────────────────────────────────────

/** GGUF model directory under the runner's own data root. */
export const LLAMACPP_MODEL_DIR = process.env["ALFRED_LLAMACPP_MODEL_DIR"] ?? "./models/llamacpp";

const LLAMACPP_TIMEOUTS: Partial<Record<RunnerStepKind, number>> = {
  "install-approved-runtime": 600,
  "pull-approved-model":      3600,
  "start-managed-runtime":    120,
  "stop-managed-runtime":     30,
  "remove-managed-model":     60,
  "verify-approved-capability": 120,
};

/**
 * llama.cpp adapter (Etappe 8a).
 *
 * pull-approved-model: calls `huggingface-cli download` — the toolchain is
 * a separate install-approved-toolchain step, never bundled here.
 *
 * start-managed-runtime: starts llama-server with an OpenAI-compatible API.
 * The port, context size and GPU-offload layers come from validated params.
 * No shell — each value is a separate argv element.
 *
 * verify-approved-capability/binary: checks that `llama-server --version`
 * exits 0. inference: sends one fixed prompt via the OpenAI-compat endpoint
 * and checks the exit code of the curl call. unloaded: checks that the
 * server is no longer listening on the configured port.
 */
export const LLAMACPP_ADAPTER: StepAdapter = {
  id: "llama.cpp",
  version: "1.0.0",
  kinds: [
    "install-approved-runtime",
    "pull-approved-model",
    "remove-managed-model",
    "start-managed-runtime",
    "stop-managed-runtime",
    "verify-approved-capability",
  ],
  validate: (step) => {
    if (!LLAMACPP_ADAPTER.kinds.includes(step.kind)) return `Adapter llama.cpp kann „${step.kind}" nicht.`;
    return validateWith(`llamacpp:${step.kind}` as keyof typeof paramsFor, step);
  },
  command: (step) => {
    const timeoutSeconds = LLAMACPP_TIMEOUTS[step.kind] ?? 60;
    const model   = typeof step.params.model    === "string" ? step.params.model    : "";
    const repoId  = typeof step.params.repoId   === "string" ? step.params.repoId   : "";
    const fname   = typeof step.params.filename === "string" ? step.params.filename : "";
    const port    = typeof step.params.port     === "number" ? String(step.params.port)     : "8080";
    const ctx     = typeof step.params.ctxSize  === "number" ? String(step.params.ctxSize)  : "4096";
    const ngl     = typeof step.params.ngl      === "number" ? String(step.params.ngl)      : "0";
    const modelPath = `${LLAMACPP_MODEL_DIR}/${model}.gguf`;

    switch (step.kind) {
      case "install-approved-runtime":
        return { argv: ["pip", "install", "--quiet", "llama-cpp-python[server]"], timeoutSeconds };

      case "pull-approved-model":
        return {
          argv: ["huggingface-cli", "download", repoId, fname, "--local-dir", LLAMACPP_MODEL_DIR],
          timeoutSeconds,
        };

      case "remove-managed-model":
        return {
          argv: ["python3", "-c", `import os,pathlib; p=pathlib.Path(${JSON.stringify(modelPath)}); p.unlink(missing_ok=True)`],
          timeoutSeconds,
        };

      case "start-managed-runtime":
        return {
          argv: [
            "llama-server",
            "--model",    modelPath,
            "--port",     port,
            "--ctx-size", ctx,
            "--n-gpu-layers", ngl,
          ],
          timeoutSeconds,
        };

      case "stop-managed-runtime":
        return {
          argv: ["curl", "--silent", "--max-time", "5", "-X", "POST", `http://localhost:${port}/shutdown`],
          timeoutSeconds,
        };

      case "verify-approved-capability": {
        const check = step.params.check as string;
        if (check === "binary")
          return { argv: ["llama-server", "--version"], timeoutSeconds };
        if (check === "inference")
          return {
            argv: [
              "curl", "--silent", "--max-time", "30",
              "-X", "POST",
              `http://localhost:${port}/v1/completions`,
              "-H", "Content-Type: application/json",
              "-d", JSON.stringify({ model, prompt: VERIFICATION_PROMPT_LLAMACPP, max_tokens: 4 }),
            ],
            timeoutSeconds,
          };
        return {
          argv: ["curl", "--silent", "--max-time", "3", `http://localhost:${port}/health`],
          timeoutSeconds,
        };
      }
      default:
        return null;
    }
  },
};

// ── 8b: vLLM ──────────────────────────────────────────────────────────────

const VLLM_TIMEOUTS: Partial<Record<RunnerStepKind, number>> = {
  "install-approved-runtime": 900,
  "pull-approved-model":      3600,
  "create-ephemeral-sandbox": 300,
  "destroy-ephemeral-sandbox": 60,
  "remove-managed-model":     60,
  "verify-approved-capability": 120,
};

/**
 * vLLM adapter (Etappe 8b).
 *
 * create-ephemeral-sandbox: starts `vllm serve` inside the current
 * environment. On a rented GPU node the delivery mode is
 * `ephemeral-container` — the runner's executor layer is responsible for
 * wrapping that in a container; the adapter only builds the argv.
 *
 * destroy-ephemeral-sandbox: sends SIGTERM to the vllm serve process;
 * the executor handles the PID. The adapter expresses intent, not mechanism.
 *
 * pull-approved-model: vLLM can load directly from the HuggingFace cache;
 * we pre-fetch with huggingface-cli so the sandbox starts immediately.
 */
export const VLLM_ADAPTER: StepAdapter = {
  id: "vllm",
  version: "1.0.0",
  kinds: [
    "install-approved-runtime",
    "pull-approved-model",
    "remove-managed-model",
    "create-ephemeral-sandbox",
    "destroy-ephemeral-sandbox",
    "verify-approved-capability",
  ],
  validate: (step) => {
    if (!VLLM_ADAPTER.kinds.includes(step.kind)) return `Adapter vllm kann „${step.kind}" nicht.`;
    return validateWith(`vllm:${step.kind}` as keyof typeof paramsFor, step);
  },
  command: (step) => {
    const timeoutSeconds = VLLM_TIMEOUTS[step.kind] ?? 60;
    const model  = typeof step.params.model === "string" ? step.params.model : "";
    const gpuMem = typeof step.params.gpuMemoryUtilization === "number"
      ? String(step.params.gpuMemoryUtilization)
      : "0.90";
    const maxLen = typeof step.params.maxModelLen === "number"
      ? String(step.params.maxModelLen)
      : undefined;

    switch (step.kind) {
      case "install-approved-runtime":
        return { argv: ["pip", "install", "--quiet", "vllm"], timeoutSeconds };

      case "pull-approved-model":
        return {
          argv: ["huggingface-cli", "download", model],
          timeoutSeconds,
        };

      case "remove-managed-model":
        return {
          argv: ["python3", "-c", `import shutil,pathlib,os; cache=pathlib.Path(os.environ.get("HF_HOME","~/.cache/huggingface")).expanduser()/"hub"; [shutil.rmtree(p) for p in cache.glob(f"models--{${JSON.stringify(model)}.replace('/','--')}*")]`],
          timeoutSeconds,
        };

      case "create-ephemeral-sandbox": {
        const argv = [
          "vllm", "serve", model,
          "--gpu-memory-utilization", gpuMem,
          "--trust-remote-code",
        ];
        if (maxLen) argv.push("--max-model-len", maxLen);
        return { argv, timeoutSeconds };
      }

      case "destroy-ephemeral-sandbox":
        return null;

      case "verify-approved-capability": {
        const check = step.params.check as string;
        if (check === "health")
          return { argv: ["curl", "--silent", "--max-time", "5", "http://localhost:8000/health"], timeoutSeconds };
        if (check === "inference")
          return {
            argv: [
              "curl", "--silent", "--max-time", "30",
              "-X", "POST",
              "http://localhost:8000/v1/completions",
              "-H", "Content-Type: application/json",
              "-d", JSON.stringify({ model, prompt: VERIFICATION_PROMPT_LLAMACPP, max_tokens: 4 }),
            ],
            timeoutSeconds,
          };
        return {
          argv: ["curl", "--silent", "--max-time", "3", "http://localhost:8000/health"],
          timeoutSeconds,
        };
      }
      default:
        return null;
    }
  },
};

// ── 8c: Termux ────────────────────────────────────────────────────────────

/** Models land in Termux's own home directory, not a system path. */
export const TERMUX_MODEL_DIR = "$HOME/llamacpp-models";

const TERMUX_TIMEOUTS: Partial<Record<RunnerStepKind, number>> = {
  "install-approved-runtime": 600,
  "pull-approved-model":      3600,
  "start-managed-runtime":    60,
  "stop-managed-runtime":     30,
  "remove-managed-model":     60,
  "verify-approved-capability": 120,
};

/**
 * Termux/llama.cpp adapter for Android (Etappe 8c).
 *
 * Termux ships its own pkg manager. We install llama.cpp from the Termux
 * community repo (`pkg install llama.cpp`), never from PyPI. Model files are
 * pulled with huggingface-cli (available via pip inside Termux).
 *
 * No long-running background service is started here — the policy for phone
 * nodes forbids it (plan §15.2). start-managed-runtime launches llama-server
 * in the foreground; the caller (the runner's executor) is responsible for
 * starting it in a Termux session that stays alive.
 */
export const TERMUX_ADAPTER: StepAdapter = {
  id: "termux-llama.cpp",
  version: "1.0.0",
  kinds: [
    "install-approved-runtime",
    "pull-approved-model",
    "remove-managed-model",
    "start-managed-runtime",
    "stop-managed-runtime",
    "verify-approved-capability",
  ],
  validate: (step) => {
    if (!TERMUX_ADAPTER.kinds.includes(step.kind)) return `Adapter termux-llama.cpp kann „${step.kind}" nicht.`;
    return validateWith(`termux:${step.kind}` as keyof typeof paramsFor, step);
  },
  command: (step) => {
    const timeoutSeconds = TERMUX_TIMEOUTS[step.kind] ?? 60;
    const model  = typeof step.params.model    === "string" ? step.params.model    : "";
    const repoId = typeof step.params.repoId   === "string" ? step.params.repoId   : "";
    const fname  = typeof step.params.filename === "string" ? step.params.filename : "";
    const port   = typeof step.params.port     === "number" ? String(step.params.port)    : "8080";
    const ctx    = typeof step.params.ctxSize  === "number" ? String(step.params.ctxSize) : "2048";
    const modelPath = `${TERMUX_MODEL_DIR}/${model}.gguf`;

    switch (step.kind) {
      case "install-approved-runtime":
        return { argv: ["pkg", "install", "-y", "llama.cpp"], timeoutSeconds };

      case "pull-approved-model":
        return {
          argv: ["huggingface-cli", "download", repoId, fname, "--local-dir", TERMUX_MODEL_DIR],
          timeoutSeconds,
        };

      case "remove-managed-model":
        return {
          argv: ["python3", "-c", `import os,pathlib; p=pathlib.Path(${JSON.stringify(modelPath)}); p.unlink(missing_ok=True)`],
          timeoutSeconds,
        };

      case "start-managed-runtime":
        return {
          argv: [
            "llama-server",
            "--model",    modelPath,
            "--port",     port,
            "--ctx-size", ctx,
          ],
          timeoutSeconds,
        };

      case "stop-managed-runtime":
        return {
          argv: ["curl", "--silent", "--max-time", "5", "-X", "POST", `http://localhost:${port}/shutdown`],
          timeoutSeconds,
        };

      case "verify-approved-capability": {
        const check = step.params.check as string;
        if (check === "binary")
          return { argv: ["llama-server", "--version"], timeoutSeconds };
        if (check === "inference")
          return {
            argv: [
              "curl", "--silent", "--max-time", "30",
              "-X", "POST",
              `http://localhost:${port}/v1/completions`,
              "-H", "Content-Type: application/json",
              "-d", JSON.stringify({ model, prompt: VERIFICATION_PROMPT_LLAMACPP, max_tokens: 4 }),
            ],
            timeoutSeconds,
          };
        return {
          argv: ["curl", "--silent", "--max-time", "3", `http://localhost:${port}/health`],
          timeoutSeconds,
        };
      }
      default:
        return null;
    }
  },
};

// ── 8c: Policy-Helpers für borrowed / rented ──────────────────────────────

/**
 * Returns the adapter ids a node may use, given its trust level.
 *
 * The rules match §15.2 of the plan:
 * - owned nodes get everything the runner ships.
 * - borrowed nodes: read-only probe + llama.cpp/Termux inference, no installs.
 * - rented nodes: vLLM in ephemeral containers only; no persistent install
 *   step unless the node's own policy explicitly allows it.
 */
export function allowedAdapterIds(trust: NodeTrust, policy: Pick<NodePolicy, "mayInstall">): string[] {
  switch (trust) {
    case "owned":
      return ["probe", "ollama", "llama.cpp", "vllm", "termux-llama.cpp"];
    case "borrowed":
      return ["probe", "llama.cpp", "termux-llama.cpp"];
    case "rented":
      return policy.mayInstall
        ? ["probe", "vllm"]
        : ["probe"];
  }
}

/**
 * Returns the step kinds refused outright on a node, regardless of which
 * adapter is being used.
 */
export function refusedKindsForTrust(trust: NodeTrust): RunnerStepKind[] {
  if (trust === "owned") return [];
  const base: RunnerStepKind[] = ["update-runner", "install-approved-toolchain"];
  if (trust === "borrowed") {
    return [...base, "install-approved-runtime", "remove-approved-runtime", "remove-managed-model"];
  }
  return base;
}

export class AdapterRegistry {
  private readonly byId = new Map<string, StepAdapter>();

  constructor(adapters: StepAdapter[]) {
    for (const a of adapters) {
      this.byId.set(a.id, a);
    }
  }

  get(id: string): StepAdapter | null {
    return this.byId.get(id) ?? null;
  }

  ids(): string[] {
    return [...this.byId.keys()];
  }

  supportedKinds(): RunnerStepKind[] {
    const kinds = new Set<RunnerStepKind>();
    for (const a of this.byId.values()) {
      for (const k of a.kinds) {
        kinds.add(k);
      }
    }
    return [...kinds];
  }

  validate(step: RunnerStep): string | null {
    const adapter = this.byId.get(step.adapterId);
    if (!adapter) return `Unbekannter Adapter: ${step.adapterId}`;
    return adapter.validate(step);
  }

  command(step: RunnerStep): { argv: string[]; timeoutSeconds: number } | null {
    const adapter = this.byId.get(step.adapterId);
    if (!adapter) return null;
    return adapter.command(step);
  }
}

export function readOnlyRegistry(): AdapterRegistry {
  return new AdapterRegistry([PROBE_ADAPTER]);
}

export function verticalSliceRegistry(): AdapterRegistry {
  return new AdapterRegistry([PROBE_ADAPTER, OLLAMA_ADAPTER]);
}

/** Etappe 8a: llama.cpp-fähige Nodes (Linux, Laptop, CPU-Fallback). */
export function llamaCppRegistry(): AdapterRegistry {
  return new AdapterRegistry([PROBE_ADAPTER, LLAMACPP_ADAPTER]);
}

/** Etappe 8b: Linux-GPU-Nodes mit vLLM und ephemeren Containern. */
export function vllmRegistry(): AdapterRegistry {
  return new AdapterRegistry([PROBE_ADAPTER, VLLM_ADAPTER]);
}

/** Etappe 8c: Android/Termux. */
export function termuxRegistry(): AdapterRegistry {
  return new AdapterRegistry([PROBE_ADAPTER, TERMUX_ADAPTER]);
}

/** Vollständige Registry für owned Nodes — alle vier Adapter. */
export function fullRegistry(): AdapterRegistry {
  return new AdapterRegistry([PROBE_ADAPTER, OLLAMA_ADAPTER, LLAMACPP_ADAPTER, VLLM_ADAPTER, TERMUX_ADAPTER]);
}
