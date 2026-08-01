import { z } from "zod";
import { dataClassSchema, detailedEvidenceRefSchema } from "./common";
import { truthStatusSchema } from "./truth";

/**
 * Raum IX · Werkstatt — the vocabulary for going from a project need to a
 * working machine (plan §14).
 *
 * The load-bearing distinction in this file is between what a node is *said*
 * to be (`NodeDeclaration`) and what a runner actually *measured*
 * (`NodeObservation`). They never merge. A preset is a declaration and can
 * never be presented as an observation.
 */

// ── 14.1 Discovery ──────────────────────────────────────────────────────────

export const discoverySourceSchema = z.enum([
  "local-bootstrap",
  "mdns",
  "tailscale",
  "pairing-code",
  "qr-code",
  "manual-address",
  "provider-api",
  "manual-declaration",
  "demo-fixture",
]);
export type DiscoverySource = z.infer<typeof discoverySourceSchema>;

export const pairingStatusSchema = z.enum([
  "discovered",
  "pairing-required",
  "paired",
  "rejected",
  "expired",
]);
export type PairingStatus = z.infer<typeof pairingStatusSchema>;

export const nodeDiscoverySchema = z.object({
  discoveredId: z.string().min(1),
  source: discoverySourceSchema,
  address: z.string().optional(),
  runnerVersion: z.string().optional(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  pairingStatus: pairingStatusSchema,
  /** Name the source suggested; the user may rename it on confirmation. */
  suggestedName: z.string().optional(),
});
export type NodeDiscovery = z.infer<typeof nodeDiscoverySchema>;

// ── 14.2 Declaration ────────────────────────────────────────────────────────

export const nodeKindSchema = z.enum(["workstation", "laptop", "nas", "phone", "borrowed", "rented"]);
export type NodeKind = z.infer<typeof nodeKindSchema>;

export const nodeOsSchema = z.enum(["windows", "linux", "macos", "android"]);
export type NodeOs = z.infer<typeof nodeOsSchema>;

export const nodeTrustSchema = z.enum(["owned", "borrowed", "rented"]);
export type NodeTrust = z.infer<typeof nodeTrustSchema>;

export const nodeAvailabilitySchema = z.enum(["always", "intermittent", "on-demand"]);
export type NodeAvailability = z.infer<typeof nodeAvailabilitySchema>;

export const gpuSchema = z.object({
  vendor: z.enum(["nvidia", "amd", "intel", "apple", "other"]),
  model: z.string(),
  vramGb: z.number().nonnegative(),
  /** True when this GPU also drives a display, which costs usable VRAM. */
  drivesDisplay: z.boolean().default(false),
});
export type Gpu = z.infer<typeof gpuSchema>;

/** What a node is *said* to have, before any runner measured it. */
export const declaredHardwareSchema = z.object({
  cpu: z.string().optional(),
  cores: z.number().int().positive().optional(),
  ramGb: z.number().positive().optional(),
  gpus: z.array(gpuSchema).default([]),
  diskFreeGb: z.number().nonnegative().optional(),
});
export type DeclaredHardware = z.infer<typeof declaredHardwareSchema>;

/** The rules only a person can supply — they are not measurable. */
export const nodePolicySchema = z.object({
  /** May ALFRET use this node without asking each time? */
  automaticUse: z.boolean().default(false),
  /** May it install runtimes, toolchains or models here? */
  mayInstall: z.boolean().default(false),
  /** Highest data sensitivity this node may process. */
  maxDataClass: dataClassSchema.default("public"),
  /** May it compute while somebody is using the machine? */
  computeWhileUserActive: z.boolean().default(false),
  /** Local times when the node must stay idle, e.g. ["22:00-07:00"]. */
  quietHours: z.array(z.string()).default([]),
  costLimitPerHour: z.number().nonnegative().optional(),
  /** Task profiles explicitly allowed here; empty means "no restriction". */
  allowedTasks: z.array(z.string()).default([]),
});
export type NodePolicy = z.infer<typeof nodePolicySchema>;

export const nodeDeclarationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: nodeKindSchema,
  os: nodeOsSchema,
  trust: nodeTrustSchema,
  availability: nodeAvailabilitySchema,
  declared: declaredHardwareSchema,
  policy: nodePolicySchema,
  /** The discovery this declaration came from — never invented on its own. */
  discovery: nodeDiscoverySchema,
  createdAt: z.string(),
});
export type NodeDeclaration = z.infer<typeof nodeDeclarationSchema>;

// ── 14.3 Observation ────────────────────────────────────────────────────────

export const installedRuntimeSchema = z.object({
  id: z.string(),
  version: z.string().optional(),
});
export type InstalledRuntime = z.infer<typeof installedRuntimeSchema>;

export const nodeObservationSchema = z.object({
  nodeId: z.string().min(1),
  observedAt: z.string(),
  runnerVersion: z.string(),
  cpu: z.string(),
  arch: z.string(),
  cores: z.number().int().positive(),
  threads: z.number().int().positive(),
  ramGb: z.number().positive(),
  gpus: z.array(gpuSchema),
  os: nodeOsSchema,
  osVersion: z.string().optional(),
  wsl: z.boolean().default(false),
  virtualized: z.boolean().default(false),
  diskFreeGb: z.number().nonnegative(),
  /** Compute stacks the runner could actually verify. */
  accelerators: z.array(z.enum(["cuda", "rocm", "directml", "vulkan", "webgpu", "metal"])).default([]),
  runtimes: z.array(installedRuntimeSchema).default([]),
  toolchains: z.array(installedRuntimeSchema).default([]),
  installedModels: z.array(z.string()).default([]),
  evidence: z.array(detailedEvidenceRefSchema).default([]),
});
export type NodeObservation = z.infer<typeof nodeObservationSchema>;

/** Declaration checked against observation, field by field. */
export const hardwareReconciliationSchema = z.object({
  field: z.string(),
  declared: z.string().nullable(),
  observed: z.string().nullable(),
  truth: truthStatusSchema,
  note: z.string().optional(),
});
export type HardwareReconciliation = z.infer<typeof hardwareReconciliationSchema>;

// ── 14.4 Resource snapshot ──────────────────────────────────────────────────

export const thermalStateSchema = z.enum(["cool", "warm", "hot", "throttling", "unknown"]);
export type ThermalState = z.infer<typeof thermalStateSchema>;

export const resourceSnapshotSchema = z.object({
  nodeId: z.string().min(1),
  takenAt: z.string(),
  /** How long this snapshot may be trusted, in seconds. */
  validForSeconds: z.number().int().positive(),
  freeRamGb: z.number().nonnegative(),
  freeVramGb: z.number().nonnegative(),
  cpuLoad: z.number().min(0).max(1),
  gpuLoad: z.number().min(0).max(1),
  diskFreeGb: z.number().nonnegative(),
  runningJobs: z.number().int().nonnegative().default(0),
  /** Models currently resident, with the VRAM they hold. */
  residentModels: z.array(z.object({ modelId: z.string(), vramGb: z.number().nonnegative() })).default([]),
  batteryPercent: z.number().min(0).max(100).optional(),
  onAcPower: z.boolean().optional(),
  thermal: thermalStateSchema.default("unknown"),
  userActive: z.boolean().default(false),
});
export type ResourceSnapshot = z.infer<typeof resourceSnapshotSchema>;

// ── 14.5 Task profiles ──────────────────────────────────────────────────────

export const taskProfileIdSchema = z.enum([
  "repository.inventory",
  "repository.reasoning",
  "donor.search",
  "donor.evaluate",
  "typescript.patch",
  "python.patch",
  "merge.conflict-repair",
  "documentation.reconcile",
  "embedding.build",
  "vision.inspect",
  "blender.pipeline",
  "model.inference",
]);
export type TaskProfileId = z.infer<typeof taskProfileIdSchema>;

export const taskProfileSchema = z.object({
  id: taskProfileIdSchema,
  label: z.string(),
  /** Sensitivity of the material this task touches. */
  dataClass: dataClassSchema,
  contextTokens: z.number().int().positive(),
  /** Needs a GPU to be worth running at all. */
  needsGpu: z.boolean().default(false),
  /** Must stay available continuously rather than being started on demand. */
  alwaysOn: z.boolean().default(false),
  /** Cannot share the node with another job. */
  exclusive: z.boolean().default(false),
  /** A smaller variant exists (shorter context, smaller model). */
  shrinkable: z.boolean().default(false),
});
export type TaskProfile = z.infer<typeof taskProfileSchema>;

// ── 14.6 / 14.7 Models ──────────────────────────────────────────────────────

export const runtimeIdSchema = z.enum(["ollama", "llama.cpp", "vllm", "termux-llama.cpp", "remote-openai"]);
export type RuntimeId = z.infer<typeof runtimeIdSchema>;

export const deliveryModeSchema = z.enum([
  "native",
  "systemd",
  "windows-service",
  "termux-service",
  "ephemeral-container",
  "remote-worker",
]);
export type DeliveryMode = z.infer<typeof deliveryModeSchema>;

export const residencySchema = z.enum(["on-demand", "warm", "always", "never-local"]);
export type Residency = z.infer<typeof residencySchema>;

export const licenseStatusSchema = z.enum(["permissive", "copyleft", "restricted", "unknown"]);
export type LicenseStatus = z.infer<typeof licenseStatusSchema>;

export const modelCandidateSchema = z.object({
  id: z.string().min(1),
  repository: z.string().min(1),
  revision: z.string().default("main"),
  format: z.enum(["gguf", "safetensors", "awq", "gptq"]),
  quantization: z.string().optional(),
  /** Effective bits per weight, when known. */
  quantBits: z.number().positive().optional(),
  fileSizeGb: z.number().positive(),
  paramsB: z.number().positive().optional(),
  layers: z.number().int().positive().optional(),
  hiddenSize: z.number().int().positive().optional(),
  /**
   * Width of the key/value projection per layer — `kvHeads × headDim`. This,
   * not `hiddenSize`, is what the KV cache scales with: grouped-query
   * attention makes it several times smaller than the hidden size.
   */
  kvDim: z.number().int().positive().optional(),
  contextLength: z.number().int().positive(),
  runtimes: z.array(runtimeIdSchema).min(1),
  license: licenseStatusSchema,
  gated: z.boolean().default(false),
  promptTemplate: z.string().optional(),
  evidence: z.array(detailedEvidenceRefSchema).default([]),
});
export type ModelCandidate = z.infer<typeof modelCandidateSchema>;

export const capabilitySourceSchema = z.enum(["published", "local-benchmark", "real-run"]);
export type CapabilitySource = z.infer<typeof capabilitySourceSchema>;

export const modelCapabilityRecordSchema = z.object({
  modelId: z.string().min(1),
  task: taskProfileIdSchema,
  /** 0..1, measured — never guessed. */
  quality: z.number().min(0).max(1),
  schemaFidelity: z.number().min(0).max(1),
  scopeFidelity: z.number().min(0).max(1),
  errorRate: z.number().min(0).max(1),
  /** How much Refinery rework the output needed, 0..1. */
  refineryRework: z.number().min(0).max(1),
  runtimeSeconds: z.number().nonnegative(),
  vramGb: z.number().nonnegative().optional(),
  costPerRun: z.number().nonnegative().optional(),
  nodeId: z.string().optional(),
  runtime: runtimeIdSchema.optional(),
  source: capabilitySourceSchema,
  observedAt: z.string(),
});
export type ModelCapabilityRecord = z.infer<typeof modelCapabilityRecordSchema>;

// ── 14.8 Placement ──────────────────────────────────────────────────────────

/**
 * `not-proven` is a first-class outcome: a fit cannot be claimed against
 * hardware that was only declared and never measured.
 */
export const placementFitSchema = z.enum(["fits", "tight", "spills", "infeasible", "not-proven"]);
export type PlacementFit = z.infer<typeof placementFitSchema>;

export const memoryEstimateSchema = z.object({
  minimumGb: z.number().nonnegative(),
  expectedGb: z.number().nonnegative(),
  maximumGb: z.number().nonnegative(),
  confidence: z.enum(["high", "medium", "low"]),
  /** What went into the estimate, so a surprising number can be traced. */
  breakdown: z.array(z.object({ label: z.string(), gb: z.number() })).default([]),
});
export type MemoryEstimate = z.infer<typeof memoryEstimateSchema>;

export const checkSpecSchema = z.object({
  id: z.string(),
  description: z.string(),
});
export type CheckSpec = z.infer<typeof checkSpecSchema>;

export const placementProposalSchema = z.object({
  task: taskProfileIdSchema,
  nodeId: z.string(),
  modelId: z.string().nullable(),
  runtime: runtimeIdSchema,
  delivery: deliveryModeSchema,
  residency: residencySchema,
  fit: placementFitSchema,
  memory: memoryEstimateSchema.nullable(),
  evidence: z.array(detailedEvidenceRefSchema).default([]),
  /** Why this node and runtime, in the planner's own words. */
  rationale: z.array(z.string()).default([]),
  /** Ordered alternatives, best first. */
  fallbackNodeIds: z.array(z.string()).default([]),
  checks: z.array(checkSpecSchema).default([]),
  warnings: z.array(z.string()).default([]),
});
export type PlacementProposal = z.infer<typeof placementProposalSchema>;

// ── 14.9 Admission ──────────────────────────────────────────────────────────

export const admissionOutcomeSchema = z.enum([
  "start",
  "wait",
  "evict-model",
  "use-other-node",
  "shrink-task",
  "suggest-rented-gpu",
  "not-executable",
]);
export type AdmissionOutcome = z.infer<typeof admissionOutcomeSchema>;

export const admissionDecisionSchema = z.object({
  outcome: admissionOutcomeSchema,
  nodeId: z.string(),
  task: taskProfileIdSchema,
  reason: z.string(),
  /** For evict-model: which resident model to unload first. */
  evictModelId: z.string().optional(),
  /** For use-other-node: where to go instead. */
  alternativeNodeId: z.string().optional(),
  decidedAt: z.string(),
});
export type AdmissionDecision = z.infer<typeof admissionDecisionSchema>;

// ── 14.10 Execution plan ────────────────────────────────────────────────────

/**
 * The shape a runner will accept (plan §17.2). Defined here so the planner and
 * the runner agree on it; nothing signs or executes one before Etappe 6/7.
 */
export const runnerStepKindSchema = z.enum([
  "probe-node",
  "install-approved-runtime",
  "update-approved-runtime",
  "remove-approved-runtime",
  "pull-approved-model",
  "remove-managed-model",
  "install-approved-toolchain",
  "start-managed-runtime",
  "stop-managed-runtime",
  "create-ephemeral-sandbox",
  "destroy-ephemeral-sandbox",
  "verify-approved-capability",
  "cleanup-managed-artifact",
  "update-runner",
]);
export type RunnerStepKind = z.infer<typeof runnerStepKindSchema>;

export const runnerStepSchema = z.object({
  kind: runnerStepKindSchema,
  /** A runtime/toolchain adapter the runner already ships. Never new code. */
  adapterId: z.string().min(1),
  adapterVersion: z.string().min(1),
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  artifactHash: z.string().optional(),
  resourceLimitGb: z.number().positive().optional(),
  rollback: z.string().optional(),
});
export type RunnerStep = z.infer<typeof runnerStepSchema>;

export const stepResultSchema = z.object({
  kind: runnerStepKindSchema,
  adapterId: z.string(),
  startedAt: z.string(),
  finishedAt: z.string(),
  exitCode: z.number().int().nullable(),
  /** Trimmed output, kept for evidence. Never contains pairing material. */
  output: z.string(),
  error: z.string().optional(),
});
export type StepResult = z.infer<typeof stepResultSchema>;

/**
 * Verdicts for a check (plan §18). `not_proven` is the default: an exit code
 * of zero on its own proves nothing.
 */
export const checkVerdictSchema = z.enum([
  "passed",
  "partially_passed",
  "failed",
  "not_proven",
  "not_applicable",
]);
export type CheckVerdict = z.infer<typeof checkVerdictSchema>;

export const checkResultSchema = z.object({
  id: z.string(),
  description: z.string(),
  verdict: checkVerdictSchema,
  /** What was actually observed, in the check's own words. */
  observed: z.string(),
});
export type CheckResult = z.infer<typeof checkResultSchema>;

export const executionReportSchema = z.object({
  planId: z.string(),
  nodeId: z.string(),
  startedAt: z.string(),
  finishedAt: z.string(),
  steps: z.array(stepResultSchema),
  checks: z.array(checkResultSchema),
  /** The report's own verdict, never better than its weakest check. */
  verdict: checkVerdictSchema,
});
export type ExecutionReport = z.infer<typeof executionReportSchema>;

export const signedExecutionPlanSchema = z.object({
  planId: z.string().min(1),
  nodeId: z.string().min(1),
  issuedAt: z.string(),
  expiresAt: z.string(),
  nonce: z.string().min(1),
  steps: z.array(runnerStepSchema),
  artifactHashes: z.array(z.string()).default([]),
  signerKeyId: z.string().min(1),
  signature: z.string().min(1),
});
export type SignedExecutionPlan = z.infer<typeof signedExecutionPlanSchema>;

// plan §17 — OperatingProfile was referenced in lib/demo/policy.ts:21 and
// app/api/demo/run/route.ts:15 but never defined. The Union lives inline in
// middleware.ts:121; here we export the canonical Zod schema.

export const operatingProfileSchema = z.union([
  z.literal("homelab"),
  z.literal("ci"),
  z.literal("local-dev"),
  z.literal("production"),
]);

export type OperatingProfile = z.infer<typeof operatingProfileSchema>;
