// plan §36 — Scope-Entscheidungen für PlannedWrite-Autorisierung

export type ScopeDecision = "authorized" | "denied" | "dry-run-only";

export interface ScopeContext {
  repository: string;
  armed: boolean;
  dryRun: boolean;
  reason?: string;
}

/**
 * Entscheide, ob ein PlannedWrite ausgeführt werden darf
 */
export function decideScopeForWrite(context: ScopeContext): ScopeDecision {
  // Wenn dryRun ist true, aber armed ist false -> dry-run-only
  if (context.dryRun && !context.armed) {
    return "dry-run-only";
  }

  // Wenn armed ist false und nicht dryRun -> denied
  if (!context.armed && !context.dryRun) {
    return "denied";
  }

  // Wenn armed ist true -> authorized (unabhängig von dryRun)
  return "authorized";
}

/**
 * Assistive Scope Assertion
 */
export function assertScope(
  repository: string,
  action: string,
  opts: { armed: boolean },
): void {
  if (!opts.armed) {
    throw new Error(`Scope denied: ${repository} is not armed for action ${action}`);
  }
}

/**
 * Check if a path is protected in the repository
 * @param repository The repository identifier (e.g., "owner/repo")
 * @param path The file path to check
 * @returns true if the path is protected
 */
export function isPathProtected(repository: string, path: string): boolean {
  // Default protected paths that apply to all repositories
  const defaultProtectedPaths = [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    ".env*",
    "*.key",
    "*.pem",
    "secrets/*",
  ];

  // Simple implementation: check if path matches any protected path
  return defaultProtectedPaths.some((p) => {
    // Basic glob matching: * = any chars, ** = any dirs
    const pattern = p
      .replace(/\./g, "\\.")
      .replace(/\*\*/g, ".*")
      .replace(/\*/g, "[^/]*");
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(path);
  });
}
