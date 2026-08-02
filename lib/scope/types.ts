// plan §18 — Scope registry types

export interface RepoScope {
  armed: boolean;
  allowedActions?: string[];
  protectedPaths?: string[];
  protectedBranches?: string[];
}

export interface ScopeRegistry {
  repositories: Record<string, RepoScope>;
}
