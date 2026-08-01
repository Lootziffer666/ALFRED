import type {
  DeliveryMode,
  NodeDeclaration,
  NodeObservation,
  RuntimeId,
  TaskProfile,
} from "../schema/homelab";

/**
 * Runtime abstraction (plan §15.1). Ollama is the convenient default, not the
 * only runtime: the choice follows hardware, operating system, task and model.
 *
 * Docker Compose is deliberately absent. It is not a general standard here and
 * not a product delivery path; the only container form is an ephemeral one for
 * a node that should keep nothing behind.
 */

export interface RuntimeChoice {
  runtime: RuntimeId;
  delivery: DeliveryMode;
  why: string;
}

export interface RuntimeContext {
  node: NodeDeclaration;
  /** Measured hardware. Absent means nothing has been verified yet. */
  observation?: NodeObservation;
  task: TaskProfile;
  /** Runtimes the chosen model can actually run in. */
  modelRuntimes?: RuntimeId[];
}

interface RuntimeRule {
  id: string;
  match: (ctx: RuntimeContext) => RuntimeChoice | null;
}

/** VRAM the runner measured; declared VRAM is a claim, not a measurement. */
export function observedVramGb(observation: NodeObservation | undefined): number {
  if (!observation) return 0;
  return observation.gpus.reduce((max, g) => Math.max(max, g.vramGb), 0);
}

export function declaredVramGb(node: NodeDeclaration): number {
  return node.declared.gpus.reduce((max, g) => Math.max(max, g.vramGb), 0);
}

function hasCuda(observation: NodeObservation | undefined): boolean {
  return observation?.accelerators.includes("cuda") ?? false;
}

/** First match wins. The order is the policy. */
const RUNTIME_RULES: RuntimeRule[] = [
  {
    id: "android-edge",
    match: ({ node }) =>
      node.os === "android"
        ? {
            runtime: "termux-llama.cpp",
            delivery: "termux-service",
            why: "Android-Node: kleine GGUF-Modelle über Termux, keine dauerhafte Hintergrundlast.",
          }
        : null,
  },
  {
    id: "rented-gpu-throughput",
    match: ({ node, observation, task }) => {
      if (node.trust !== "rented" || node.os !== "linux") return null;
      if (observedVramGb(observation) < 16 && !observation) return null;
      return {
        runtime: "vllm",
        delivery: "ephemeral-container",
        why: `Miet-GPU unter Linux: vLLM im kurzlebigen Container, damit nach „${task.id}" nichts zurückbleibt.`,
      };
    },
  },
  {
    id: "linux-large-gpu-throughput",
    match: ({ node, observation, task }) => {
      if (node.os !== "linux" || !hasCuda(observation)) return null;
      if (observedVramGb(observation) < 20) return null;
      if (!task.exclusive && task.contextTokens < 16000) return null;
      return {
        runtime: "vllm",
        delivery: node.availability === "always" ? "systemd" : "ephemeral-container",
        why: "Linux-GPU ab 20 GB mit Durchsatz-Aufgabe: vLLM.",
      };
    },
  },
  {
    id: "windows-gpu-standard",
    match: ({ node, observation }) => {
      if (node.os !== "windows" || !hasCuda(observation)) return null;
      return {
        runtime: "ollama",
        delivery: "windows-service",
        why: "Windows mit CUDA-GPU: Ollama als unkomplizierter lokaler Standard, als Dienst.",
      };
    },
  },
  {
    id: "linux-gpu-standard",
    match: ({ node, observation }) => {
      if (node.os !== "linux" || !hasCuda(observation)) return null;
      return {
        runtime: "ollama",
        delivery: node.availability === "always" ? "systemd" : "native",
        why: "Linux mit CUDA-GPU unterhalb der Durchsatzschwelle: Ollama.",
      };
    },
  },
  {
    id: "cpu-edge",
    match: ({ node }) => ({
      runtime: "llama.cpp",
      delivery: node.os === "windows" ? "native" : node.availability === "always" ? "systemd" : "native",
      why:
        node.kind === "nas"
          ? "NAS ohne belegte GPU: llama.cpp auf der CPU, sparsam und ohne Treiberkette."
          : "Keine belegte GPU: llama.cpp mit GGUF auf der CPU.",
    }),
  },
];

/**
 * Chooses a runtime for a node and task. Unmeasured hardware never earns a
 * GPU runtime: without an observation the rules fall through to the CPU path,
 * because a declared GPU is a claim and claims do not run models.
 */
export function chooseRuntime(ctx: RuntimeContext): RuntimeChoice {
  for (const rule of RUNTIME_RULES) {
    const choice = rule.match(ctx);
    if (!choice) continue;
    if (ctx.modelRuntimes && !ctx.modelRuntimes.includes(choice.runtime)) continue;
    return choice;
  }
  return {
    runtime: "llama.cpp",
    delivery: "native",
    why: "Rückfallebene: llama.cpp, weil keine Regel eine bessere Zuordnung belegt.",
  };
}

/** Whether a node may host a task that has to stay available continuously. */
export function canHostAlwaysOn(node: NodeDeclaration): boolean {
  return node.availability === "always" && node.trust === "owned";
}
