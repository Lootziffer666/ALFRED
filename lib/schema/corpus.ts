import { z } from "zod";
import { detailedEvidenceRefSchema } from "./common";
import { truthStatusSchema } from "./truth";

/**
 * The versioned project corpus (plan §9 and §10). Three corpora with three
 * different standings, kept apart by *type* rather than by convention: only
 * the project corpus is binding, and only it can produce an active need.
 */

export const corpusKindSchema = z.enum(["project", "donor", "external"]);
export type CorpusKind = z.infer<typeof corpusKindSchema>;

export const repoRefSchema = z.object({
  owner: z.string().min(1),
  name: z.string().min(1),
  ref: z.string().optional(),
});
export type RepoRef = z.infer<typeof repoRefSchema>;

/** A capability the repository is said, seen, or shown to have. */
export const capabilityClaimSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  truth: truthStatusSchema,
  evidenceIds: z.array(z.string()).default([]),
});
export type CapabilityClaim = z.infer<typeof capabilityClaimSchema>;

const baseEntrySchema = z.object({
  repo: repoRefSchema,
  addedAt: z.string(),
  capabilities: z.array(capabilityClaimSchema).default([]),
  /** The commit the capabilities were read at, if known. */
  observedAtCommit: z.string().optional(),
});

export const projectEntrySchema = baseEntrySchema.extend({ corpus: z.literal("project") });
export const donorEntrySchema = baseEntrySchema.extend({
  corpus: z.literal("donor"),
  /** Where it came from: a star, a SQLite import, or a manual note. */
  origin: z.enum(["star", "sqlite-import", "manual"]),
});
export const externalEntrySchema = baseEntrySchema.extend({
  corpus: z.literal("external"),
  /** External finds stay unverified until a person says otherwise. */
  assessment: z.literal("unverified"),
});

export type ProjectEntry = z.infer<typeof projectEntrySchema>;
export type DonorEntry = z.infer<typeof donorEntrySchema>;
export type ExternalEntry = z.infer<typeof externalEntrySchema>;
export type CorpusEntry = ProjectEntry | DonorEntry | ExternalEntry;

/** Binding: something the project must resolve. Only `project` produces these. */
export const needSchema = z.object({
  id: z.string(),
  repo: repoRefSchema,
  capabilityId: z.string(),
  reason: z.string(),
  truth: truthStatusSchema,
});
export type Need = z.infer<typeof needSchema>;

/** Non-binding: an idea worth looking at. Everything donor and external yields. */
export const suggestionSchema = z.object({
  id: z.string(),
  corpus: z.enum(["donor", "external"]),
  repo: repoRefSchema,
  capabilityId: z.string(),
  note: z.string(),
});
export type Suggestion = z.infer<typeof suggestionSchema>;

// ── Evidence store (§10.4) ──────────────────────────────────────────────────

export const evidenceKindSchema = z.enum([
  "file",
  "commit",
  "pull_request",
  "issue",
  "build",
  "test",
  "artifact",
]);
export type EvidenceKind = z.infer<typeof evidenceKindSchema>;

export const evidenceRecordSchema = z.object({
  id: z.string().min(1),
  kind: evidenceKindSchema,
  ref: detailedEvidenceRefSchema,
  recordedAt: z.string(),
});
export type EvidenceRecord = z.infer<typeof evidenceRecordSchema>;

// ── Project graph (§10.5) ───────────────────────────────────────────────────

export const graphNodeKindSchema = z.enum([
  "product",
  "module",
  "capability",
  "contract",
  "dependency",
  "runtime",
  "artifact",
  "worker",
  "requirement",
  "risk",
  "donor-candidate",
]);
export type GraphNodeKind = z.infer<typeof graphNodeKindSchema>;

export const graphNodeSchema = z.object({
  id: z.string().min(1),
  kind: graphNodeKindSchema,
  label: z.string().min(1),
  corpus: corpusKindSchema,
  truth: truthStatusSchema,
  evidenceIds: z.array(z.string()).default([]),
});
export type GraphNode = z.infer<typeof graphNodeSchema>;

export const graphEdgeKindSchema = z.enum([
  "provides",
  "requires",
  "depends-on",
  "contradicts",
  "supersedes",
  "candidate-for",
]);
export type GraphEdgeKind = z.infer<typeof graphEdgeKindSchema>;

export const graphEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  kind: graphEdgeKindSchema,
});
export type GraphEdge = z.infer<typeof graphEdgeSchema>;

// ── Decision ledger (§10.6) ─────────────────────────────────────────────────

export const decisionSchema = z.object({
  id: z.string().min(1),
  statement: z.string().min(1),
  rationale: z.string(),
  /** Where the decision applies: a repository, a module, or the whole system. */
  scope: z.string().min(1),
  status: z.enum(["active", "superseded"]),
  rejectedAlternatives: z.array(z.string()).default([]),
  evidenceIds: z.array(z.string()).default([]),
  /** Decisions this one replaces. */
  supersedes: z.array(z.string()).default([]),
  decidedAt: z.string(),
});
export type Decision = z.infer<typeof decisionSchema>;

// ── Snapshot (§10.7) ────────────────────────────────────────────────────────

export const CORPUS_SNAPSHOT_VERSION = 1;

export const corpusSnapshotSchema = z.object({
  version: z.literal(CORPUS_SNAPSHOT_VERSION),
  exportedAt: z.string(),
  project: z.array(projectEntrySchema).default([]),
  donor: z.array(donorEntrySchema).default([]),
  external: z.array(externalEntrySchema).default([]),
  evidence: z.array(evidenceRecordSchema).default([]),
  nodes: z.array(graphNodeSchema).default([]),
  edges: z.array(graphEdgeSchema).default([]),
  decisions: z.array(decisionSchema).default([]),
});
export type CorpusSnapshot = z.infer<typeof corpusSnapshotSchema>;
