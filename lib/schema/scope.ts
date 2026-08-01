import { z } from "zod";
import { dataClassSchema } from "./common";

/**
 * The scope registry (plan §11). ALFRET works only inside explicitly released
 * scope; anything not released is `escalated`, never quietly allowed.
 *
 * v1 is Zod-validated JSON. The project has no YAML dependency, and adding one
 * for a config file this small would be an abstraction without need.
 */

const permission = z.union([z.boolean(), z.literal("approval-required")]);

export const repositoryScopeSchema = z.object({
  observe: permission.default(false),
  prepareChanges: permission.default(false),
  createPullRequest: permission.default(false),
  refineryMerge: permission.default(false),
  executeInSandbox: permission.default(false),
  write: permission.default(false),
  destructiveCleanup: permission.default(false),
  /** Paths that stay untouched even where writing is allowed. */
  protectedPaths: z.array(z.string()).default([]),
  dataClass: dataClassSchema.default("private"),
  /** How much the system may do before asking. */
  autonomy: z.enum(["observe-only", "propose", "act"]).default("observe-only"),
});
export type RepositoryScope = z.infer<typeof repositoryScopeSchema>;

export const scopeRegistrySchema = z.object({
  repositories: z.record(z.string(), repositoryScopeSchema).default({}),
});
export type ScopeRegistry = z.infer<typeof scopeRegistrySchema>;

/** The actions a scope entry can release. Each maps to one permission field. */
export const scopeActionSchema = z.enum([
  "observe",
  "prepare-changes",
  "create-pull-request",
  "refinery-merge",
  "execute-in-sandbox",
  "write",
  "destructive-cleanup",
]);
export type ScopeAction = z.infer<typeof scopeActionSchema>;

export const SCOPE_ACTION_FIELDS: Record<ScopeAction, keyof RepositoryScope> = {
  observe: "observe",
  "prepare-changes": "prepareChanges",
  "create-pull-request": "createPullRequest",
  "refinery-merge": "refineryMerge",
  "execute-in-sandbox": "executeInSandbox",
  write: "write",
  "destructive-cleanup": "destructiveCleanup",
};

export type ScopeOutcome = "allowed" | "approval-required" | "escalated";

export interface ScopeDecision {
  outcome: ScopeOutcome;
  repository: string;
  action: ScopeAction;
  reason: string;
}
