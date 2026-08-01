import type { MemoryEstimate, ModelCandidate, PlacementFit, RuntimeId } from "../schema/homelab";

/**
 * Memory as a range, never a single number (plan §15.3).
 *
 * A 12 GB model is not automatically fine on a 12 GB GPU: weights are only one
 * term. The KV cache grows with context and batch, the runtime keeps its own
 * allocations, an accelerator context costs memory before a single token is
 * produced, and a GPU that also drives a display has less to give than its
 * sticker says. The estimate carries its own breakdown so a surprising number
 * can be traced instead of argued about.
 */

/** K and V are both held, so the cache pays for two tensors. */
const KV_TENSORS = 2;

/**
 * Reference `layers × kvDim` for a 7B model with grouped-query attention.
 *
 * Deliberately *not* `layers × hiddenSize`: every current model of this size
 * uses GQA, which makes the key/value projection several times narrower than
 * the hidden state. Qwen2.5-7B is 28 × 512 = 14 336; Llama-3-8B is 32 × 1024
 * = 32 768. Assuming full multi-head attention overstates the cache by roughly
 * an order of magnitude, which is the difference between "runs on a 3060" and
 * "impossible".
 */
const REFERENCE_KV_FACTOR = 24_000;
const REFERENCE_PARAMS_B = 7;

/** How far the real factor sits from the reference when the shape is unknown. */
const KV_BAND_LOW = 0.55;
const KV_BAND_HIGH = 1.6;

const RUNTIME_OVERHEAD_GB: Record<RuntimeId, number> = {
  ollama: 0.6,
  "llama.cpp": 0.35,
  vllm: 1.8,
  "termux-llama.cpp": 0.25,
  "remote-openai": 0,
};

const ACCELERATOR_CONTEXT_GB = 0.5;
const DISPLAY_RESERVE_GB = 0.8;
const OS_RESERVE_GB = 1.5;

export interface MemoryInput {
  model: ModelCandidate;
  contextTokens: number;
  runtime: RuntimeId;
  target: "gpu" | "cpu";
  batch?: number;
  /** 16 for fp16 KV, 8 when the runtime quantises the cache. */
  kvBits?: number;
  /** The GPU also drives a display, so not all of its VRAM is available. */
  drivesDisplay?: boolean;
}

/** Weights in billions, inferred from file size when the model does not say. */
function inferParamsB(model: ModelCandidate): number | null {
  if (model.paramsB) return model.paramsB;
  if (!model.quantBits) return null;
  return (model.fileSizeGb * 8) / model.quantBits;
}

interface KvBand {
  low: number;
  expected: number;
  high: number;
  confidence: MemoryEstimate["confidence"];
}

/**
 * `layers × kvDim`, which is what the KV cache actually scales with.
 *
 * Exact when the model states its attention geometry. Otherwise a band: the
 * GQA ratio varies between architectures, and that uncertainty belongs in the
 * range rather than in a single confident-looking number.
 */
function kvBand(model: ModelCandidate): KvBand {
  if (model.layers && model.kvDim) {
    const exact = model.layers * model.kvDim;
    return { low: exact, expected: exact, high: exact, confidence: "high" };
  }

  const params = inferParamsB(model);
  const expected = params
    ? REFERENCE_KV_FACTOR * Math.pow(params / REFERENCE_PARAMS_B, 2 / 3)
    : REFERENCE_KV_FACTOR;

  return {
    low: expected * KV_BAND_LOW,
    expected,
    high: expected * KV_BAND_HIGH,
    confidence: params && model.paramsB ? "medium" : "low",
  };
}

export function estimateMemory(input: MemoryInput): MemoryEstimate {
  const { model, contextTokens, runtime, target } = input;
  const batch = input.batch ?? 1;
  const kvBits = input.kvBits ?? 16;

  const weightsGb = model.fileSizeGb;
  const kv = kvBand(model);
  const perFactor = (KV_TENSORS * contextTokens * batch * (kvBits / 8)) / 1e9;
  const kvLowGb = kv.low * perFactor;
  const kvGb = kv.expected * perFactor;
  const kvHighGb = kv.high * perFactor;

  const runtimeGb = RUNTIME_OVERHEAD_GB[runtime];
  const acceleratorGb = target === "gpu" ? ACCELERATOR_CONTEXT_GB : 0;
  const displayGb = target === "gpu" && input.drivesDisplay ? DISPLAY_RESERVE_GB : 0;
  const osGb = target === "cpu" ? OS_RESERVE_GB : 0;

  const kvLabel =
    kv.confidence === "high"
      ? `KV-Cache (${contextTokens} Token, Batch ${batch}, ${kvBits} bit)`
      : `KV-Cache (${contextTokens} Token, Batch ${batch}, ${kvBits} bit, Attention-Geometrie geschätzt)`;

  const breakdown = [
    { label: "Gewichte", gb: round(weightsGb) },
    { label: kvLabel, gb: round(kvGb) },
    { label: `Runtime-Overhead (${runtime})`, gb: round(runtimeGb) },
  ];
  if (acceleratorGb) breakdown.push({ label: "Accelerator-Kontext", gb: round(acceleratorGb) });
  if (displayGb) breakdown.push({ label: "Display-Reserve", gb: round(displayGb) });
  if (osGb) breakdown.push({ label: "Betriebssystem-Reserve", gb: round(osGb) });

  const fixedGb = runtimeGb + acceleratorGb + displayGb + osGb;
  const expected = weightsGb + kvGb + fixedGb;
  // Best case: a tight allocator, no fragmentation, and the narrow end of the
  // cache. Weights, some cache and the accelerator context are not optional.
  const minimum = weightsGb + kvLowGb + runtimeGb * 0.8 + acceleratorGb;
  // Worst case: the wide end of the cache, plus fragmentation and the
  // transient peaks of a long generation.
  const maximum = (weightsGb + kvHighGb + fixedGb) * (target === "gpu" ? 1.2 : 1.15);

  return {
    minimumGb: round(minimum),
    expectedGb: round(expected),
    maximumGb: round(maximum),
    confidence: kv.confidence,
    breakdown,
  };
}

function round(gb: number): number {
  return Math.round(gb * 100) / 100;
}

/**
 * How an estimate relates to what a node can actually give.
 *
 * Only `fits` means "the worst case still has room". `tight` means the usual
 * case fits but a peak will not — usable with eyes open, never automatically.
 */
export function fitFor(estimate: MemoryEstimate, availableGb: number): PlacementFit {
  if (availableGb >= estimate.maximumGb) return "fits";
  if (availableGb >= estimate.expectedGb) return "tight";
  if (availableGb >= estimate.minimumGb) return "spills";
  return "infeasible";
}

/** Fits the planner may place without asking. */
export function isPlaceable(fit: PlacementFit): boolean {
  return fit === "fits";
}

/**
 * Whether several models can be resident at once. Peaks do not all happen at
 * the same instant, so the budget is checked against the expected footprints
 * plus the single largest peak.
 */
export function residentBudget(estimates: MemoryEstimate[], capacityGb: number): {
  ok: boolean;
  requiredGb: number;
  capacityGb: number;
} {
  const expected = estimates.reduce((sum, e) => sum + e.expectedGb, 0);
  const largestPeak = estimates.reduce((max, e) => Math.max(max, e.maximumGb - e.expectedGb), 0);
  const requiredGb = round(expected + largestPeak);
  return { ok: requiredGb <= capacityGb, requiredGb, capacityGb };
}
