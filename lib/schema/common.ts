import { z } from "zod";

/**
 * A pointer back to the concrete evidence a claim is based on, e.g.
 * "package.json · scripts.build" or "PLAN.md · lines 120-136".
 */
export const evidenceRefSchema = z.object({
  source: z.string().min(1),
  url: z.string().url().optional(),
});
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;

/**
 * The richer pointer used by corpus, report, runner and refinery findings
 * (plan §10.3). Every added field is optional, so the small schema above stays
 * valid everywhere it is already used — this extends the vocabulary rather
 * than making detailed evidence mandatory after the fact.
 */
export const detailedEvidenceRefSchema = evidenceRefSchema.extend({
  repository: z.string().optional(),
  commitSha: z.string().optional(),
  path: z.string().optional(),
  symbol: z.string().optional(),
  lineStart: z.number().int().positive().optional(),
  lineEnd: z.number().int().positive().optional(),
  artifactHash: z.string().optional(),
  observedAt: z.string().optional(),
});
export type DetailedEvidenceRef = z.infer<typeof detailedEvidenceRefSchema>;

/**
 * How sensitive the data a repository or a task handles is. Shared by the
 * scope registry and the homelab planner so a task's sensitivity and a
 * repository's classification are expressed in the same vocabulary.
 */
export const dataClassSchema = z.enum(["public", "private", "secret"]);
export type DataClass = z.infer<typeof dataClassSchema>;

/**
 * Every piece of gathered evidence must visibly declare why it is (not)
 * present instead of silently defaulting to empty (PRD §5.2 / §5.3).
 */
export const availabilityStatusSchema = z.enum([
  "loaded",
  "loading",
  "unavailable_permissions",
  "unavailable_rate_limited",
  "failed",
  "skipped",
]);
export type AvailabilityStatus = z.infer<typeof availabilityStatusSchema>;

export function availabilitySchema<T extends z.ZodTypeAny>(data: T) {
  return z.discriminatedUnion("status", [
    z.object({ status: z.literal("loaded"), data }),
    z.object({ status: z.literal("loading") }),
    z.object({ status: z.literal("unavailable_permissions"), reason: z.string() }),
    z.object({ status: z.literal("unavailable_rate_limited"), reason: z.string() }),
    z.object({ status: z.literal("failed"), reason: z.string() }),
    z.object({ status: z.literal("skipped"), reason: z.string() }),
  ]);
}

export type Availability<T> =
  | { status: "loaded"; data: T }
  | { status: "loading" }
  | { status: "unavailable_permissions"; reason: string }
  | { status: "unavailable_rate_limited"; reason: string }
  | { status: "failed"; reason: string }
  | { status: "skipped"; reason: string };

export function loaded<T>(data: T): Availability<T> {
  return { status: "loaded", data };
}
export function unavailable(
  status: Exclude<AvailabilityStatus, "loaded" | "loading">,
  reason: string,
): Availability<never> {
  return { status, reason } as Availability<never>;
}
