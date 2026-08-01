import { z } from "zod";
import {
  modelCapabilityRecordSchema,
  type ModelCapabilityRecord,
  type RuntimeId,
  type TaskProfileId,
} from "../schema/homelab";

/**
 * Capability history (plan §14.7). What a model actually did here, per task —
 * the only thing that can make a model "proven" in `lib/homelab/models.ts`.
 *
 * A published claim is stored too, so it can be compared later, but it never
 * counts as a measurement.
 */

export const BENCHMARK_HISTORY_VERSION = 1;

export const benchmarkHistorySchema = z.object({
  version: z.literal(BENCHMARK_HISTORY_VERSION),
  exportedAt: z.string(),
  records: z.array(modelCapabilityRecordSchema).default([]),
});
export type BenchmarkHistoryFile = z.infer<typeof benchmarkHistorySchema>;

export interface CapabilitySummary {
  modelId: string;
  task: TaskProfileId;
  runs: number;
  measuredRuns: number;
  quality: number;
  schemaFidelity: number;
  scopeFidelity: number;
  errorRate: number;
  refineryRework: number;
  medianRuntimeSeconds: number;
  /** True when at least one local benchmark or real run backs this. */
  measured: boolean;
  lastObservedAt: string;
  nodes: string[];
  runtimes: RuntimeId[];
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export class BenchmarkHistory {
  private readonly records: ModelCapabilityRecord[] = [];

  constructor(records: ModelCapabilityRecord[] = []) {
    this.records.push(...records);
  }

  add(record: ModelCapabilityRecord): ModelCapabilityRecord {
    this.records.push(record);
    return record;
  }

  all(): ModelCapabilityRecord[] {
    return [...this.records];
  }

  /** Records for one model and task, newest first. */
  for(modelId: string, task: TaskProfileId): ModelCapabilityRecord[] {
    return this.records
      .filter((r) => r.modelId === modelId && r.task === task)
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  }

  /**
   * Aggregates a model's history for one task. Averages are taken over
   * *measured* runs only — a published number would otherwise quietly lift a
   * model that was never run here.
   */
  summarise(modelId: string, task: TaskProfileId): CapabilitySummary | null {
    const all = this.for(modelId, task);
    if (all.length === 0) return null;

    const measured = all.filter((r) => r.source !== "published");
    const basis = measured.length > 0 ? measured : all;

    return {
      modelId,
      task,
      runs: all.length,
      measuredRuns: measured.length,
      quality: mean(basis.map((r) => r.quality)),
      schemaFidelity: mean(basis.map((r) => r.schemaFidelity)),
      scopeFidelity: mean(basis.map((r) => r.scopeFidelity)),
      errorRate: mean(basis.map((r) => r.errorRate)),
      refineryRework: mean(basis.map((r) => r.refineryRework)),
      medianRuntimeSeconds: median(basis.map((r) => r.runtimeSeconds)),
      measured: measured.length > 0,
      lastObservedAt: all[0].observedAt,
      nodes: [...new Set(all.map((r) => r.nodeId).filter((n): n is string => Boolean(n)))],
      runtimes: [...new Set(all.map((r) => r.runtime).filter((r): r is RuntimeId => Boolean(r)))],
    };
  }

  /** Everything known about a task, best measured result first. */
  leaderboard(task: TaskProfileId): CapabilitySummary[] {
    const models = [...new Set(this.records.filter((r) => r.task === task).map((r) => r.modelId))];
    return models
      .map((id) => this.summarise(id, task))
      .filter((s): s is CapabilitySummary => s !== null)
      .sort((a, b) => {
        // Measured before unmeasured, then by quality. A published claim never
        // outranks something that actually ran here.
        if (a.measured !== b.measured) return a.measured ? -1 : 1;
        return b.quality - a.quality;
      });
  }

  toJSON(exportedAt = new Date().toISOString()): BenchmarkHistoryFile {
    return { version: BENCHMARK_HISTORY_VERSION, exportedAt, records: this.all() };
  }
}

export class BenchmarkVersionError extends Error {
  constructor(found: unknown) {
    super(
      `Benchmark history version ${String(found)} cannot be read by this build ` +
        `(expected ${BENCHMARK_HISTORY_VERSION}).`,
    );
    this.name = "BenchmarkVersionError";
  }
}

export function importBenchmarkHistory(raw: string | unknown): BenchmarkHistory {
  let input: unknown;
  if (typeof raw === "string") {
    try {
      input = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Benchmark-Historie ist kein gültiges JSON: ${(err as Error).message}`);
    }
  } else {
    input = raw;
  }

  const version = (input as { version?: unknown })?.version;
  if (version !== BENCHMARK_HISTORY_VERSION) throw new BenchmarkVersionError(version);

  const parsed = benchmarkHistorySchema.safeParse(input);
  if (!parsed.success) throw new Error(`Benchmark-Historie ist fehlerhaft:\n${z.prettifyError(parsed.error)}`);

  return new BenchmarkHistory(parsed.data.records);
}
