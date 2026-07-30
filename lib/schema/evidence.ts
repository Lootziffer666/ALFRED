import { z } from "zod";
import { availabilitySchema, evidenceRefSchema } from "./common";

export const repoIdentitySchema = z.object({
  owner: z.string().min(1),
  name: z.string().min(1),
  ref: z.string().min(1),
  url: z.string().url(),
  defaultBranch: z.string().min(1),
  description: z.string().nullable().optional(),
  private: z.boolean().optional(),
});
export type RepoIdentity = z.infer<typeof repoIdentitySchema>;

export const fileEntrySchema = z.object({
  path: z.string(),
  type: z.enum(["file", "dir"]),
  size: z.number().optional(),
  skipped: z.boolean().optional(),
  skipReason: z.string().optional(),
});
export type FileEntry = z.infer<typeof fileEntrySchema>;

export const docEvidenceSchema = z.object({
  path: z.string(),
  excerpt: z.string(),
  truncated: z.boolean(),
  fullLength: z.number(),
});
export type DocEvidence = z.infer<typeof docEvidenceSchema>;

export const packageManifestSchema = z.object({
  path: z.string(),
  detectedStack: z.array(z.string()),
  packageManager: z.string().nullable(),
  scripts: z.record(z.string(), z.string()),
});
export type PackageManifest = z.infer<typeof packageManifestSchema>;

export const commitEvidenceSchema = z.object({
  sha: z.string(),
  message: z.string(),
  author: z.string().nullable(),
  date: z.string().nullable(),
  url: z.string().url(),
});
export type CommitEvidence = z.infer<typeof commitEvidenceSchema>;

export const pullRequestSummarySchema = z.object({
  openCount: z.number(),
  recent: z.array(
    z.object({
      number: z.number(),
      title: z.string(),
      state: z.string(),
      url: z.string().url(),
    }),
  ),
});
export type PullRequestSummary = z.infer<typeof pullRequestSummarySchema>;

export const issueSummarySchema = z.object({
  openCount: z.number(),
});
export type IssueSummary = z.infer<typeof issueSummarySchema>;

export const repoEvidenceSchema = z.object({
  identity: repoIdentitySchema,
  fetchedAt: z.string(),
  tree: availabilitySchema(z.array(fileEntrySchema)),
  docs: availabilitySchema(z.array(docEvidenceSchema)),
  packageManifest: availabilitySchema(packageManifestSchema.nullable()),
  commits: availabilitySchema(z.array(commitEvidenceSchema)),
  pullRequests: availabilitySchema(pullRequestSummarySchema),
  issues: availabilitySchema(issueSummarySchema),
  warnings: z.array(z.string()),
});
export type RepoEvidence = z.infer<typeof repoEvidenceSchema>;

export { evidenceRefSchema };
