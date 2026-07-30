import { z } from "zod";
import { evidenceRefSchema } from "./common";

export const findingStatusSchema = z.enum([
  "implemented",
  "partially_implemented",
  "documented_only",
  "contradicted",
  "unclear",
  "out_of_scope",
]);
export type FindingStatus = z.infer<typeof findingStatusSchema>;

export const contractFindingSchema = z.object({
  id: z.string().min(1),
  claim: z.string().min(1),
  status: findingStatusSchema,
  evidenceFor: z.array(evidenceRefSchema),
  evidenceAgainst: z.array(evidenceRefSchema),
  confidence: z.number().min(0).max(1),
  explanation: z.string().min(1),
  missingProof: z.string().nullable().optional(),
});
export type ContractFinding = z.infer<typeof contractFindingSchema>;

/** Shape requested from the model; validated at runtime before use (PRD §5.4). */
export const contractMapModelResponseSchema = z.object({
  findings: z.array(contractFindingSchema).min(1),
});
export type ContractMapModelResponse = z.infer<typeof contractMapModelResponseSchema>;

export const contractMapSchema = z.object({
  modelId: z.string(),
  generatedAt: z.string(),
  findings: z.array(contractFindingSchema),
});
export type ContractMap = z.infer<typeof contractMapSchema>;
