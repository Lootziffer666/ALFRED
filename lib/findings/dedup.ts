// Finding dedup: merge duplicate observations via intent comparison.
// Groups findings by (repository, path, kind), keeps first + merges metadata.

import type { MaidFinding } from "../maid/types.js";
import type { FindingCapsule } from "./capsule.js";

export interface MergedFinding {
  finding: MaidFinding;
  observations: number;
  firstObservedAt: string;
  lastObservedAt: string;
  commits: Set<string>;
  sources: Set<string>;
}

/**
 * Group findings by (repository, path, kind) and merge duplicates.
 * Returns map of checksum → MergedFinding.
 */
export function dedup(capsules: FindingCapsule[]): Map<string, MergedFinding> {
  const map = new Map<string, MergedFinding>();

  for (const capsule of capsules) {
    const key = `${capsule.repository}#${capsule.finding.path}#${capsule.finding.kind}`;

    if (map.has(key)) {
      const existing = map.get(key)!;
      existing.observations += 1;
      existing.commits.add(capsule.commitSha);
      existing.sources.add(capsule.source);

      // Update observed timestamps
      if (capsule.observedAt < existing.firstObservedAt) {
        existing.firstObservedAt = capsule.observedAt;
      }
      if (capsule.observedAt > existing.lastObservedAt) {
        existing.lastObservedAt = capsule.observedAt;
      }
    } else {
      map.set(key, {
        finding: capsule.finding,
        observations: 1,
        firstObservedAt: capsule.observedAt,
        lastObservedAt: capsule.observedAt,
        commits: new Set([capsule.commitSha]),
        sources: new Set([capsule.source]),
      });
    }
  }

  return map;
}

/**
 * Filter merged findings by severity and kind.
 */
export function filterMerged(
  merged: Map<string, MergedFinding>,
  opts?: {
    severities?: string[];
    kinds?: string[];
    minObservations?: number;
  },
): Map<string, MergedFinding> {
  const filtered = new Map<string, MergedFinding>();

  for (const [key, merged] of merged) {
    if (opts?.minObservations && merged.observations < opts.minObservations) continue;
    if (opts?.severities && !opts.severities.includes(merged.finding.severity)) continue;
    if (opts?.kinds && !opts.kinds.includes(merged.finding.kind)) continue;
    filtered.set(key, merged);
  }

  return filtered;
}

/**
 * Sort merged findings: by severity (high → low), then observations (high → low).
 */
export function sortMerged(merged: Map<string, MergedFinding>): MergedFinding[] {
  const severityOrder: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };

  return Array.from(merged.values()).sort((a, b) => {
    const severityDiff =
      (severityOrder[a.finding.severity] ?? 5) - (severityOrder[b.finding.severity] ?? 5);
    if (severityDiff !== 0) return severityDiff;
    return b.observations - a.observations;
  });
}

/**
 * Compute dedup stats: total, unique, repeated.
 */
export function dedupStats(
  capsules: FindingCapsule[],
  merged: Map<string, MergedFinding>,
): { total: number; unique: number; repeated: number; avgObservations: number } {
  const totalObservations = Array.from(merged.values()).reduce((sum, m) => sum + m.observations, 0);
  return {
    total: capsules.length,
    unique: merged.size,
    repeated: merged.size - totalObservations,
    avgObservations: totalObservations / merged.size,
  };
}
