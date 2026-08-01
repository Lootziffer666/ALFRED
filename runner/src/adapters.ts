import { z } from "zod";
import type { RunnerStep, RunnerStepKind } from "../../lib/schema/homelab";

/**
 * Runtime and toolchain adapters (plan §17.4).
 *
 * Adapters are a versioned part of the runner. A plan may reference an adapter
 * id and pass strictly validated parameters — it can never carry adapter code
 * or a shell string. Everything an adapter runs is assembled here from
 * validated values and executed as an argument vector, never through a shell,
 * so a parameter cannot become a command.
 */

export interface AdapterCommand {
  /** Executable and arguments. No shell, so no quoting or injection.  */
  argv: string[];
  /** Seconds after which the step is abandoned. */
  timeoutSeconds: number;
}

export interface StepAdapter {
  id: string;
  version: string;
  kinds: readonly RunnerStepKind[];
  /** Returns a message when the parameters are unacceptable, null when fine. */
  validate(step: RunnerStep): string | null;
  /** Builds the command. Adapters that need no process return null. */
  command(step: RunnerStep): AdapterCommand | null;
}

/** Deliberately narrow: names only, no paths, no separators, no spaces. */
const modelName = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/, "Modellname enthält unzulässige Zeichen.");

const paramsFor = {
  "probe-node": z.object({}).strict(),
  "install-approved-runtime": z.object({ runtime: z.literal("ollama") }).strict(),
  "start-managed-runtime": z.object({ runtime: z.literal("ollama") }).strict(),
  "stop-managed-runtime": z.object({ runtime: z.literal("ollama"), model: modelName.optional() }).strict(),
  "pull-approved-model": z.object({ runtime: z.literal("ollama"), model: modelName }).strict(),
  "remove-managed-model": z.object({ runtime: z.literal("ollama"), model: modelName }).strict(),
  "verify-approved-capability": z
    .object({ runtime: z.literal("ollama"), model: modelName, check: z.enum(["models", "inference", "unloaded"]) })
    .strict(),
} as const;

function validateWith(kind: keyof typeof paramsFor, step: RunnerStep): string | null {
  const parsed = paramsFor[kind].safeParse(step.params);
  return parsed.success ? null : z.prettifyError(parsed.error);
}

/** Reads the machine's own hardware. Handled in-process, so no command. */
export const PROBE_ADAPTER: StepAdapter = {
  id: "probe",
  version: "1.0.0",
  kinds: ["probe-node"],
  validate: (step) => validateWith("probe-node", step),
  command: () => null,
};

/** Fixed, so a verification cannot smuggle in a prompt of its own. */
export const VERIFICATION_PROMPT = "Antworte mit genau einem Wort: OK";

/**
 * Package managers this adapter will call, by platform. Absent means the
 * runner refuses to install Ollama there rather than running a download
 * through a shell.
 */
export const INSTALLERS: Partial<Record<NodeJS.Platform, string[]>> = {
  win32: ["winget", "install", "--exact", "--id", "Ollama.Ollama", "--accept-package-agreements", "--accept-source-agreements"],
  darwin: ["brew", "install", "ollama"],
};

const OLLAMA_TIMEOUTS: Partial<Record<RunnerStepKind, number>> = {
  "install-approved-runtime": 900,
  "pull-approved-model": 3600,
  "start-managed-runtime": 60,
  "stop-managed-runtime": 60,
  "remove-managed-model": 120,
  "verify-approved-capability": 120,
};

/**
 * Ollama, for the Windows vertical slice (plan §24, Etappe 7). Installation is
 * delegated to the platform's own package manager rather than to a downloaded
 * script, so nothing this runner executes came over the wire.
 */
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
    return validateWith(step.kind as keyof typeof paramsFor, step);
  },
  command: (step) => {
    const timeoutSeconds = OLLAMA_TIMEOUTS[step.kind] ?? 60;
    const model = typeof step.params.model === "string" ? step.params.model : "";

    switch (step.kind) {
      case "install-approved-runtime": {
        // Only through a platform package manager, invoked directly. The
        // vendor's own path is a piped download into a shell, and this runner
        // does not spawn shells — so where there is no vetted manager, there
        // is no installation, and the step says so instead of improvising.
        const installer = INSTALLERS[process.platform];
        return installer ? { argv: installer, timeoutSeconds } : null;
      }
      case "start-managed-runtime":
        return { argv: ["ollama", "serve"], timeoutSeconds };
      case "stop-managed-runtime":
        // Unloads the model immediately; without one, stops the server.
        return { argv: model ? ["ollama", "stop", model] : ["ollama", "stop"], timeoutSeconds };
      case "pull-approved-model":
        return { argv: ["ollama", "pull", model], timeoutSeconds };
      case "remove-managed-model":
        return { argv: ["ollama", "rm", model], timeoutSeconds };
      case "verify-approved-capability":
        // The prompt is a constant in this file, never a parameter — a check
        // must not become a channel for arbitrary input.
        if (step.params.check === "inference") {
          return { argv: ["ollama", "run", model, VERIFICATION_PROMPT], timeoutSeconds };
        }
        return { argv: ["ollama", step.params.check === "models" ? "list" : "ps"], timeoutSeconds };
      default:
        return null;
    }
  },
};

export class AdapterRegistry {
  private readonly byId = new Map<string, StepAdapter>();

  constructor(adapters: StepAdapter[]) {
    for (const adapter of adapters) this.byId.set(adapter.id, adapter);
  }

  get(id: string): StepAdapter | undefined {
    return this.byId.get(id);
  }

  ids(): string[] {
    return [...this.byId.keys()];
  }

  /** Every step kind any installed adapter can perform. */
  supportedKinds(): RunnerStepKind[] {
    return [...new Set([...this.byId.values()].flatMap((a) => [...a.kinds]))];
  }
}

/** Etappe 6: reading only. The runner ships no adapter that changes anything. */
export function readOnlyRegistry(): AdapterRegistry {
  return new AdapterRegistry([PROBE_ADAPTER]);
}

/** Etappe 7: the Windows slice, which needs Ollama as well. */
export function verticalSliceRegistry(): AdapterRegistry {
  return new AdapterRegistry([PROBE_ADAPTER, OLLAMA_ADAPTER]);
}
