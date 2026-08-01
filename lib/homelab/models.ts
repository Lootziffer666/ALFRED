import type {
  MemoryEstimate,
  ModelCandidate,
  ModelCapabilityRecord,
  PlacementFit,
  RuntimeId,
  TaskProfile,
} from "../schema/homelab";
import { estimateMemory, fitFor, isPlaceable } from "./memory";

/**
 * Model choice (plan §15.2). Hardware fit is a precondition, never a verdict:
 * a model can `fit` without having been shown to be suitable, let alone best.
 *
 * Suitability comes from measurements only — a local benchmark or a real run.
 * A published claim is recorded as such and never ranked as if it had been
 * observed here.
 */

export type Suitability = "proven" | "published-only" | "unproven";

export interface RankedModel {
  candidate: ModelCandidate;
  memory: MemoryEstimate;
  fit: PlacementFit;
  suitability: Suitability;
  /** The measurements the suitability rests on. Empty when unproven. */
  records: ModelCapabilityRecord[];
  /** Reasons this model must not be chosen automatically. */
  blockers: string[];
  /**
   * Only present once suitability is `proven`. A number here for an unmeasured
   * model would be a claim ALFRET cannot back, so it stays null.
   */
  score: number | null;
}

export interface ModelRankingContext {
  task: TaskProfile;
  runtime: RuntimeId;
  target: "gpu" | "cpu";
  availableGb: number;
  drivesDisplay?: boolean;
  batch?: number;
  kvBits?: number;
  records: ModelCapabilityRecord[];
}

function suitabilityOf(records: ModelCapabilityRecord[]): Suitability {
  if (records.some((r) => r.source === "real-run" || r.source === "local-benchmark")) return "proven";
  if (records.length > 0) return "published-only";
  return "unproven";
}

/** Measured quality, weighted towards the things Refinery has to clean up. */
function scoreFrom(records: ModelCapabilityRecord[]): number {
  const measured = records.filter((r) => r.source !== "published");
  const mean = (pick: (r: ModelCapabilityRecord) => number) =>
    measured.reduce((sum, r) => sum + pick(r), 0) / measured.length;

  return (
    0.3 * mean((r) => r.quality) +
    0.2 * mean((r) => r.schemaFidelity) +
    0.2 * mean((r) => r.scopeFidelity) +
    0.15 * (1 - mean((r) => r.errorRate)) +
    0.15 * (1 - mean((r) => r.refineryRework))
  );
}

function blockersFor(candidate: ModelCandidate, ctx: ModelRankingContext, fit: PlacementFit): string[] {
  const blockers: string[] = [];

  if (candidate.gated) {
    blockers.push("Modell ist gated — der Zugang ist nicht belegt.");
  }
  if (candidate.license === "unknown") {
    blockers.push("Lizenz unbekannt — ohne geprüfte Lizenz keine automatische Auswahl.");
  }
  if (candidate.license === "restricted") {
    blockers.push("Lizenz beschränkt die Nutzung — das muss eine Person entscheiden.");
  }
  if (!candidate.runtimes.includes(ctx.runtime)) {
    blockers.push(`Modell läuft nicht unter ${ctx.runtime}.`);
  }
  if (candidate.contextLength < ctx.task.contextTokens) {
    blockers.push(
      `Kontext zu kurz: ${candidate.contextLength} Token, die Aufgabe braucht ${ctx.task.contextTokens}.`,
    );
  }
  if (!isPlaceable(fit)) {
    blockers.push(`Speicher reicht nicht sicher: Fit ist „${fit}".`);
  }
  return blockers;
}

export function rankModel(candidate: ModelCandidate, ctx: ModelRankingContext): RankedModel {
  const memory = estimateMemory({
    model: candidate,
    contextTokens: ctx.task.contextTokens,
    runtime: ctx.runtime,
    target: ctx.target,
    batch: ctx.batch,
    kvBits: ctx.kvBits,
    drivesDisplay: ctx.drivesDisplay,
  });
  const fit = fitFor(memory, ctx.availableGb);

  const records = ctx.records.filter((r) => r.modelId === candidate.id && r.task === ctx.task.id);
  const suitability = suitabilityOf(records);
  const blockers = blockersFor(candidate, ctx, fit);

  return {
    candidate,
    memory,
    fit,
    suitability,
    records,
    blockers,
    score: suitability === "proven" ? scoreFrom(records) : null,
  };
}

export function rankModels(candidates: ModelCandidate[], ctx: ModelRankingContext): RankedModel[] {
  return candidates
    .map((c) => rankModel(c, ctx))
    .sort((a, b) => {
      // Proven first, then by measured score. Nothing unmeasured outranks a
      // measurement, and unmeasured models keep their input order.
      if (a.score !== null && b.score !== null) return b.score - a.score;
      if (a.score !== null) return -1;
      if (b.score !== null) return 1;
      return 0;
    });
}

/**
 * The model ALFRET may choose on its own: measured for this task, and free of
 * blockers. Returns null when nothing qualifies — fitting the hardware is not
 * enough to be called best, and an unmeasured model is never promoted just
 * because it is the only one left.
 */
export function bestModel(ranked: RankedModel[]): RankedModel | null {
  return ranked.find((r) => r.suitability === "proven" && r.blockers.length === 0) ?? null;
}

/** Candidates that would run, but whose suitability nobody has established. */
export function usableButUnproven(ranked: RankedModel[]): RankedModel[] {
  return ranked.filter((r) => r.blockers.length === 0 && r.suitability !== "proven");
}
