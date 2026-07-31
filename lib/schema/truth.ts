import { z } from "zod";

/**
 * How well a statement is supported (plan §10.2).
 *
 * Deliberately separate from `Availability<T>`, which stays a *fetch* status:
 * knowing that a file loaded says nothing about whether its claims are true.
 *
 *   README claims a Blender export        → declared
 *   the export function was found         → observed
 *   a fixture was exported and checked    → verified
 */
export const truthStatusSchema = z.enum([
  "declared",
  "observed",
  "verified",
  "not_proven",
  "contradicted",
  "stale",
]);
export type TruthStatus = z.infer<typeof truthStatusSchema>;

/** Only a checked result counts as proven. Plausibility never does. */
export function isProven(status: TruthStatus): boolean {
  return status === "verified";
}

/** Statuses that describe an open question rather than a settled answer. */
export function isOpen(status: TruthStatus): boolean {
  return status === "declared" || status === "not_proven" || status === "stale" || status === "contradicted";
}

/**
 * Evidence observed at one commit says nothing about a later one. Anything
 * that was `observed` or `verified` becomes `stale` when the repository moved
 * on; a statement that was never supported does not improve by ageing, so its
 * status is left as it is.
 */
export function staleIfMoved(status: TruthStatus, observedAtCommit: string | undefined, headCommit: string): TruthStatus {
  if (!observedAtCommit || observedAtCommit === headCommit) return status;
  return status === "observed" || status === "verified" ? "stale" : status;
}
