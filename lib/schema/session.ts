import { z } from "zod";
import { repoEvidenceSchema } from "./evidence";
import { contractMapSchema } from "./contract";
import { handoffSchema } from "./handoff";
import { acceptanceReportSchema } from "./audit";

/**
 * The full exportable session. Never include API keys or GitHub tokens
 * here (PRD §5.7 / §10.3) — only derived, non-secret evidence.
 */
export const sessionExportSchema = z.object({
  exportedAt: z.string(),
  repo: z.object({
    owner: z.string(),
    name: z.string(),
    ref: z.string(),
    url: z.string().url(),
  }),
  inventory: repoEvidenceSchema.nullable(),
  contractMap: contractMapSchema.nullable(),
  handoff: handoffSchema.nullable(),
  acceptanceReport: acceptanceReportSchema.nullable(),
  warnings: z.array(z.string()),
  modelsUsed: z.array(
    z.object({ purpose: z.string(), modelId: z.string() }),
  ),
});
export type SessionExport = z.infer<typeof sessionExportSchema>;
