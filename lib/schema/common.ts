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
