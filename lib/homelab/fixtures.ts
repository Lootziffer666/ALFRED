import type {
  ModelCandidate,
  ModelCapabilityRecord,
  NodeDeclaration,
  NodeDiscovery,
  NodePolicy,
  TaskProfile,
  TaskProfileId,
} from "../schema/homelab";
import { confirmDiscovery } from "./discovery";

/**
 * Demo fixtures for Raum IX (plan §13.4).
 *
 * These are *planning assumptions*: hardware as the user describes it, before
 * any runner measured anything. Every one carries `source: "demo-fixture"`, so
 * nothing downstream can mistake it for an observation. The planner will say
 * `not-proven` for all of them until a probe exists — which is the point.
 */

const AT = "2026-07-31T00:00:00.000Z";

function fixtureDiscovery(id: string, name: string): NodeDiscovery {
  return {
    discoveredId: `fixture:${id}`,
    source: "demo-fixture",
    firstSeenAt: AT,
    lastSeenAt: AT,
    pairingStatus: "discovered",
    suggestedName: name,
  };
}

const OWNED_WORKSTATION_POLICY: NodePolicy = {
  automaticUse: true,
  mayInstall: true,
  maxDataClass: "secret",
  computeWhileUserActive: false,
  quietHours: [],
  allowedTasks: [],
};

const OWNED_LAPTOP_POLICY: NodePolicy = {
  ...OWNED_WORKSTATION_POLICY,
  maxDataClass: "private",
  quietHours: ["23:00-07:00"],
};

const NAS_POLICY: NodePolicy = {
  automaticUse: true,
  mayInstall: false,
  maxDataClass: "private",
  computeWhileUserActive: true,
  quietHours: [],
  allowedTasks: ["embedding.build", "repository.inventory"],
};

const BORROWED_POLICY: NodePolicy = {
  automaticUse: false,
  mayInstall: false,
  maxDataClass: "public",
  computeWhileUserActive: false,
  quietHours: [],
  allowedTasks: [],
};

const RENTED_POLICY: NodePolicy = {
  automaticUse: false,
  mayInstall: true,
  maxDataClass: "public",
  computeWhileUserActive: true,
  quietHours: [],
  allowedTasks: [],
  costLimitPerHour: 1.5,
};

const PHONE_POLICY: NodePolicy = {
  automaticUse: false,
  mayInstall: true,
  maxDataClass: "private",
  computeWhileUserActive: false,
  quietHours: ["23:00-08:00"],
  allowedTasks: ["documentation.reconcile", "donor.search"],
};

export const FIXTURE_NODES: readonly NodeDeclaration[] = [
  confirmDiscovery(fixtureDiscovery("workstation", "Windows-PC"), {
    id: "workstation",
    name: "Windows-PC",
    kind: "workstation",
    os: "windows",
    trust: "owned",
    availability: "always",
    declared: {
      cpu: "AMD Ryzen 7 3700X",
      cores: 8,
      ramGb: 16,
      gpus: [{ vendor: "nvidia", model: "GeForce RTX 3060", vramGb: 12, drivesDisplay: true }],
      diskFreeGb: 400,
    },
    policy: OWNED_WORKSTATION_POLICY,
    createdAt: AT,
  }),
  confirmDiscovery(fixtureDiscovery("laptop", "ThinkPad T580"), {
    id: "laptop",
    name: "ThinkPad T580",
    kind: "laptop",
    os: "linux",
    trust: "owned",
    availability: "intermittent",
    declared: { cpu: "Intel Core i5", cores: 4, ramGb: 8, gpus: [], diskFreeGb: 120 },
    policy: OWNED_LAPTOP_POLICY,
    createdAt: AT,
  }),
  confirmDiscovery(fixtureDiscovery("nas", "NAS"), {
    id: "nas",
    name: "NAS",
    kind: "nas",
    os: "linux",
    trust: "owned",
    availability: "always",
    declared: { ramGb: 4, gpus: [], diskFreeGb: 8000 },
    policy: NAS_POLICY,
    createdAt: AT,
  }),
  confirmDiscovery(fixtureDiscovery("borrowed", "Rechner eines Bekannten"), {
    id: "borrowed",
    name: "Rechner eines Bekannten",
    kind: "borrowed",
    os: "windows",
    trust: "borrowed",
    availability: "on-demand",
    declared: {
      cpu: "AMD Ryzen 7 9800X3D",
      cores: 8,
      ramGb: 32,
      gpus: [{ vendor: "nvidia", model: "24 GB GPU", vramGb: 24, drivesDisplay: true }],
      diskFreeGb: 500,
    },
    policy: BORROWED_POLICY,
    createdAt: AT,
  }),
  confirmDiscovery(fixtureDiscovery("rented", "Miet-GPU"), {
    id: "rented",
    name: "Miet-GPU",
    kind: "rented",
    os: "linux",
    trust: "rented",
    availability: "on-demand",
    declared: {
      cores: 16,
      ramGb: 64,
      gpus: [{ vendor: "nvidia", model: "L4", vramGb: 24, drivesDisplay: false }],
      diskFreeGb: 200,
    },
    policy: RENTED_POLICY,
    createdAt: AT,
  }),
  confirmDiscovery(fixtureDiscovery("phone", "Smartphone"), {
    id: "phone",
    name: "Smartphone",
    kind: "phone",
    os: "android",
    trust: "owned",
    availability: "on-demand",
    declared: { ramGb: 8, gpus: [], diskFreeGb: 40 },
    policy: PHONE_POLICY,
    createdAt: AT,
  }),
];

export function fixtureNode(id: string): NodeDeclaration {
  const found = FIXTURE_NODES.find((n) => n.id === id);
  if (!found) throw new Error(`Unknown fixture node: ${id}`);
  return found;
}

// ── Task catalogue ──────────────────────────────────────────────────────────

const TASKS: Record<TaskProfileId, Omit<TaskProfile, "id">> = {
  "repository.inventory": {
    label: "Repository inventarisieren",
    dataClass: "public",
    contextTokens: 8000,
    needsGpu: false,
    alwaysOn: false,
    exclusive: false,
    shrinkable: true,
  },
  "repository.reasoning": {
    label: "Repository verstehen",
    dataClass: "private",
    contextTokens: 32000,
    needsGpu: true,
    alwaysOn: false,
    exclusive: false,
    shrinkable: true,
  },
  "donor.search": {
    label: "Donors suchen",
    dataClass: "public",
    contextTokens: 8000,
    needsGpu: false,
    alwaysOn: false,
    exclusive: false,
    shrinkable: true,
  },
  "donor.evaluate": {
    label: "Donors bewerten",
    dataClass: "public",
    contextTokens: 16000,
    needsGpu: true,
    alwaysOn: false,
    exclusive: false,
    shrinkable: true,
  },
  "typescript.patch": {
    label: "TypeScript-Patch",
    dataClass: "private",
    contextTokens: 32000,
    needsGpu: true,
    alwaysOn: false,
    exclusive: false,
    shrinkable: false,
  },
  "python.patch": {
    label: "Python-Patch",
    dataClass: "private",
    contextTokens: 32000,
    needsGpu: true,
    alwaysOn: false,
    exclusive: false,
    shrinkable: false,
  },
  "merge.conflict-repair": {
    label: "Merge-Konflikt reparieren",
    dataClass: "private",
    contextTokens: 24000,
    needsGpu: true,
    alwaysOn: false,
    exclusive: true,
    shrinkable: false,
  },
  "documentation.reconcile": {
    label: "Dokumentation abgleichen",
    dataClass: "private",
    contextTokens: 12000,
    needsGpu: false,
    alwaysOn: false,
    exclusive: false,
    shrinkable: true,
  },
  "embedding.build": {
    label: "Embeddings bauen",
    dataClass: "private",
    contextTokens: 2000,
    needsGpu: false,
    alwaysOn: true,
    exclusive: false,
    shrinkable: true,
  },
  "vision.inspect": {
    label: "Bild prüfen",
    dataClass: "private",
    contextTokens: 8000,
    needsGpu: true,
    alwaysOn: false,
    exclusive: false,
    shrinkable: false,
  },
  "blender.pipeline": {
    label: "Blender-Pipeline",
    dataClass: "private",
    contextTokens: 4000,
    needsGpu: true,
    alwaysOn: false,
    exclusive: true,
    shrinkable: false,
  },
  "model.inference": {
    label: "Modell-Inferenz",
    dataClass: "public",
    contextTokens: 8000,
    needsGpu: true,
    alwaysOn: false,
    exclusive: false,
    shrinkable: true,
  },
};

export const TASK_PROFILES: readonly TaskProfile[] = (Object.keys(TASKS) as TaskProfileId[]).map((id) => ({
  id,
  ...TASKS[id],
}));

export function taskProfile(id: TaskProfileId): TaskProfile {
  const found = TASK_PROFILES.find((t) => t.id === id);
  if (!found) throw new Error(`Unknown task profile: ${id}`);
  return found;
}

// ── Model candidates ────────────────────────────────────────────────────────

/** Illustrative candidates, not a fetched catalogue. Etappe 5 brings the real one. */
export const FIXTURE_MODELS: readonly ModelCandidate[] = [
  {
    id: "small-3b-q4",
    repository: "example/small-3b-instruct-GGUF",
    revision: "main",
    format: "gguf",
    quantization: "Q4_K_M",
    quantBits: 4.5,
    fileSizeGb: 1.9,
    paramsB: 3,
    layers: 28,
    hiddenSize: 3072,
    // 8 KV heads of 128 under grouped-query attention.
    kvDim: 1024,
    contextLength: 32768,
    runtimes: ["ollama", "llama.cpp", "termux-llama.cpp"],
    license: "permissive",
    gated: false,
    evidence: [],
  },
  {
    id: "mid-8b-q4",
    repository: "example/mid-8b-instruct-GGUF",
    revision: "main",
    format: "gguf",
    quantization: "Q4_K_M",
    quantBits: 4.5,
    fileSizeGb: 4.9,
    paramsB: 8,
    layers: 32,
    hiddenSize: 4096,
    kvDim: 1024,
    contextLength: 32768,
    runtimes: ["ollama", "llama.cpp", "vllm"],
    license: "permissive",
    gated: false,
    evidence: [],
  },
  {
    id: "large-32b-q4",
    repository: "example/large-32b-instruct-GGUF",
    revision: "main",
    format: "gguf",
    quantization: "Q4_K_M",
    quantBits: 4.5,
    fileSizeGb: 19.5,
    paramsB: 32,
    layers: 64,
    hiddenSize: 5120,
    kvDim: 1024,
    contextLength: 32768,
    runtimes: ["ollama", "llama.cpp", "vllm"],
    license: "permissive",
    gated: false,
    evidence: [],
  },
  {
    id: "gated-13b",
    repository: "example/gated-13b",
    revision: "main",
    format: "safetensors",
    fileSizeGb: 7.5,
    paramsB: 13,
    contextLength: 8192,
    runtimes: ["vllm"],
    license: "restricted",
    gated: true,
    evidence: [],
  },
];

/**
 * Measured results. Only these can make a model "proven" for a task — a model
 * without a record here is offered, never chosen.
 */
export const FIXTURE_RECORDS: readonly ModelCapabilityRecord[] = [
  {
    modelId: "mid-8b-q4",
    task: "repository.reasoning",
    quality: 0.78,
    schemaFidelity: 0.9,
    scopeFidelity: 0.86,
    errorRate: 0.08,
    refineryRework: 0.15,
    runtimeSeconds: 42,
    vramGb: 7.2,
    nodeId: "workstation",
    runtime: "ollama",
    source: "local-benchmark",
    observedAt: AT,
  },
  {
    modelId: "small-3b-q4",
    task: "documentation.reconcile",
    quality: 0.62,
    schemaFidelity: 0.81,
    scopeFidelity: 0.79,
    errorRate: 0.14,
    refineryRework: 0.26,
    runtimeSeconds: 11,
    nodeId: "phone",
    runtime: "termux-llama.cpp",
    source: "real-run",
    observedAt: AT,
  },
];
