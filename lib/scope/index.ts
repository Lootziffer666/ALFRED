// plan §18 — parseScopeRegistry and EMPTY_SCOPE_REGISTRY referenced by lib/daemon/scope.ts.
// If already defined under a different name, re-export here for a stable interface.

import { z } from "zod";
import type { ScopeRegistry } from "./types";

export const EMPTY_SCOPE_REGISTRY: ScopeRegistry = {
  repositories: {},
};

const scopeRegistrySchema = z.object({
  repositories: z.record(
    z.string(),
    z.object({
      armed: z.boolean().default(false),
      allowedActions: z.array(z.string()).default([]),
      protectedPaths: z.array(z.string()).default([]),
      protectedBranches: z.array(z.string()).default(["main", "master"]),
    }),
  ),
});

export type ParseScopeResult =
  | { ok: true; registry: ScopeRegistry }
  | { ok: false; error: string };

export function parseScopeRegistry(raw: unknown): ParseScopeResult {
  const result = scopeRegistrySchema.safeParse(raw);

  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }

  return { ok: true, registry: result.data as ScopeRegistry };
}
