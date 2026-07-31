import {
  SCOPE_ACTION_FIELDS,
  scopeRegistrySchema,
  type RepositoryScope,
  type ScopeAction,
  type ScopeDecision,
  type ScopeRegistry,
} from "../schema/scope";

/**
 * Every writing or executing path calls this first (plan §11). A repository
 * that is not in the registry is not "probably fine" — it is `escalated`.
 */

export const EMPTY_SCOPE_REGISTRY: ScopeRegistry = { repositories: {} };

export class ScopeViolationError extends Error {
  readonly decision: ScopeDecision;
  constructor(decision: ScopeDecision) {
    super(`Scope denies "${decision.action}" on ${decision.repository}: ${decision.reason}`);
    this.name = "ScopeViolationError";
    this.decision = decision;
  }
}

/** Parses untrusted JSON into a registry. Throws with a readable message. */
export function parseScopeRegistry(input: unknown): ScopeRegistry {
  return scopeRegistrySchema.parse(input);
}

export function repositoryKey(repo: string | { owner: string; name: string }): string {
  return typeof repo === "string" ? repo : `${repo.owner}/${repo.name}`;
}

export function scopeFor(registry: ScopeRegistry, repo: string | { owner: string; name: string }): RepositoryScope | null {
  return registry.repositories[repositoryKey(repo)] ?? null;
}

export function checkScope(
  registry: ScopeRegistry,
  repo: string | { owner: string; name: string },
  action: ScopeAction,
): ScopeDecision {
  const repository = repositoryKey(repo);
  const entry = registry.repositories[repository];

  if (!entry) {
    return {
      outcome: "escalated",
      repository,
      action,
      reason: "Repository steht nicht in der Scope Registry.",
    };
  }

  const permission = entry[SCOPE_ACTION_FIELDS[action]];

  if (permission === true) {
    return { outcome: "allowed", repository, action, reason: "Ausdrücklich freigegeben." };
  }
  if (permission === "approval-required") {
    return {
      outcome: "approval-required",
      repository,
      action,
      reason: "Freigegeben, aber nur nach ausdrücklicher Bestätigung.",
    };
  }
  return {
    outcome: "escalated",
    repository,
    action,
    reason: `Die Aktion „${action}" ist für dieses Repository nicht freigegeben.`,
  };
}

/** Hard gate for call sites that must not continue without a release. */
export function assertScope(
  registry: ScopeRegistry,
  repo: string | { owner: string; name: string },
  action: ScopeAction,
): ScopeDecision {
  const decision = checkScope(registry, repo, action);
  if (decision.outcome !== "allowed") throw new ScopeViolationError(decision);
  return decision;
}

/** A protected path stays untouched even where writing is released. */
export function isPathProtected(
  registry: ScopeRegistry,
  repo: string | { owner: string; name: string },
  path: string,
): boolean {
  const entry = scopeFor(registry, repo);
  if (!entry) return true;
  return entry.protectedPaths.some((p) => path === p || path.startsWith(p.endsWith("/") ? p : `${p}/`));
}
