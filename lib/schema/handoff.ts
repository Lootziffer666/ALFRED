import { z } from "zod";

export const acceptanceCriterionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});
export type AcceptanceCriterion = z.infer<typeof acceptanceCriterionSchema>;

export const handoffSchema = z.object({
  id: z.string().min(1),
  repo: z.object({
    owner: z.string(),
    name: z.string(),
    ref: z.string(),
  }),
  currentVerifiedState: z.string(),
  objective: z.string(),
  nonGoals: z.array(z.string()),
  constraints: z.array(z.string()),
  relevantFiles: z.array(z.string()),
  deliverables: z.array(z.string()),
  acceptanceCriteria: z.array(acceptanceCriterionSchema).min(1),
  requiredTestsAndEvidence: z.array(z.string()),
  prohibitedChanges: z.array(z.string()),
  stopConditions: z.array(z.string()),
  responseFormat: z.string(),
  sourceFindingIds: z.array(z.string()),
  createdAt: z.string(),
});
export type Handoff = z.infer<typeof handoffSchema>;
