// plan §18 — Scope registry: load, parse, fail-closed by construction.
// Wraps the existing parseScopeRegistry from lib/scope/.
// Missing scope.json → EMPTY_SCOPE_REGISTRY (no repo is armed, nothing happens).

import { readJson, scopePath, writeJson, ensureAlfretDirs } from "./paths.js";
import { parseScopeRegistry, EMPTY_SCOPE_REGISTRY } from "../scope/index.js";
import type { ScopeRegistry } from "../scope/types.js";

export type { ScopeRegistry };
export { EMPTY_SCOPE_REGISTRY };

export interface LoadScopeResult {
  registry: ScopeRegistry;
  source: "file" | "empty";
  warnings: string[];
}

/**
 * Load the scope registry from ~/.alfret/scope.json.
 * Missing file → EMPTY_SCOPE_REGISTRY + warning (fail-closed).
 * Malformed file → throw (start refused).
 */
export async function loadScopeRegistry(
  file = scopePath(),
): Promise<LoadScopeResult> {
  const warnings: string[] = [];

  const raw = await readJson<unknown>(file);

  if (raw === null) {
    warnings.push(
      `scope.json not found at ${file}. ` +
        `No repositories are registered. Run: alfret-daemon add-repo <owner/repo>`,
    );
    return { registry: EMPTY_SCOPE_REGISTRY, source: "empty", warnings };
  }

  const result = parseScopeRegistry(raw);

  if (!result.ok) {
    throw new Error(`Invalid scope.json at ${file}: ${result.error}`);
  }

  return { registry: result.registry, source: "file", warnings };
}

/**
 * Persist the scope registry to disk.
 * scope.json is 0o600 — it maps repository names to armed status.
 */
export async function saveScopeRegistry(registry: ScopeRegistry): Promise<void> {
  await ensureAlfretDirs();

  await writeJson(scopePath(), registry, 0o600);
}

/**
 * Register a new repository in the scope file with sensible safe defaults.
 * armed: false always — the operator must explicitly arm after adding.
 */
export async function addRepository(
  repository: string,
  file = scopePath(),
): Promise<void> {
  const { registry } = await loadScopeRegistry(file);

  const updated: ScopeRegistry = {
    ...registry,
    repositories: {
      ...registry.repositories,
      [repository]: {
        armed: false,
        allowedActions: [],
        protectedPaths: [],
        protectedBranches: ["main", "master", "release/*"],
      },
    },
  };

  await writeJson(file, updated, 0o600);
}
