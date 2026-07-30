import { z } from "zod";
import { evidenceRefSchema } from "./common";

export const changedFileSchema = z.object({
  path: z.string(),
  status: z.enum(["added", "modified", "removed", "renamed"]),
  additions: z.number(),
  deletions: z.number(),
  patchExcerpt: z.string().optional(),
});
export type ChangedFile = z.infer<typeof changedFileSchema>;

export const criterionVerdictSchema = z.enum([
  "passed",
  "partially_passed",
  "failed",
  "not_proven",
  "not_applicable",
]);
export type CriterionVerdict = z.infer<typeof criterionVerdictSchema>;

export const criterionEvaluationSchema = z.object({
  criterionId: z.string(),
  criterionText: z.string(),
  verdict: criterionVerdictSchema,
  evidence: z.array(evidenceRefSchema),
  note: z.string(),
});
export type CriterionEvaluation = z.infer<typeof criterionEvaluationSchema>;

export const submittedChangeSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: "pull_request", url: z.string().url() }),
  z.object({ kind: "compare", url: z.string().url() }),
  z.object({ kind: "pasted_diff", diff: z.string() }),
  z.object({ kind: "demo_fixture" }),
]);
export type SubmittedChangeSource = z.infer<typeof submittedChangeSourceSchema>;

export const acceptanceReportSchema = z.object({
  handoffId: z.string(),
  source: submittedChangeSourceSchema,
  generatedAt: z.string(),
  changedFiles: z.array(changedFileSchema),
  criteria: z.array(criterionEvaluationSchema),
  unsupportedClaims: z.array(z.string()),
  summary: z.string(),
});
export type AcceptanceReport = z.infer<typeof acceptanceReportSchema>;
