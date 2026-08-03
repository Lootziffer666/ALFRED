import type { ConflictClass, ConflictRecord, RepairVerdict } from "./types";

/**
 * Klassifiziert Merge-Konflikte deterministisch.
 *
 * Die Regeln prüfen Pfad-Muster und bekannte Dateiarten. Semantische
 * Konflikte — alles was nicht eindeutig einem Muster zugeordnet werden
 * kann — landen in "semantic-unknown" und werden eskaliert.
 */

const FORMATTER_PATHS = /\.(ts|tsx|js|jsx|css|json|md)$/;
const GENERATED_PATHS = /\.d\.ts$|__generated__|codegen/;
const LOCKFILE_PATHS = /bun\.lockb$|package-lock\.json$|yarn\.lock$|pnpm-lock\.yaml$/;
const CONTRACT_PATHS = /lib\/schema\//;
const SCOPE_PATHS = /lib\/scope\//;
const TEST_PATHS = /\.(test|spec)\.(ts|tsx|js|jsx)$|(^|\/)(tests?|__tests__)\//;
/** Eine entfernte Zeile im Diff-Hunk: "-" am Zeilenanfang, aber kein "---"-Header. */
const REMOVED_LINE_RE = /^-(?!--)/m;
const TEST_WEAKEN_RE = /\bskip\b|\bxdescribe\b|\bxit\b|\btest\.skip\b/;

export function classifyConflict(
  path: string,
  diffHunk: string,
): ConflictClass {
  if (LOCKFILE_PATHS.test(path)) return "lockfile";
  if (GENERATED_PATHS.test(path)) return "generated-file";
  if (CONTRACT_PATHS.test(path)) return "contract-change";
  if (SCOPE_PATHS.test(path)) return "scope-expansion";
  // Tests sind der einzige Beweis, dass ein Merge nichts kaputt macht — wer
  // sie im selben PR entfernt oder stilllegt, wird nicht durchgelassen.
  //
  // Die frühere Fassung suchte im HUNK nach einer entfernten Zeile, die auf
  // ".test.ts" endet. Das trifft nur auf Diffs von Datei-Listen zu; die
  // Löschung im Test selbst ("-import { describe }") blieb unerkannt und fiel
  // stillschweigend auf "semantic-unknown" zurück.
  if (TEST_PATHS.test(path)) {
    if (REMOVED_LINE_RE.test(diffHunk)) return "removed-test";
    if (TEST_WEAKEN_RE.test(diffHunk)) return "weakened-test";
  }

  if (FORMATTER_PATHS.test(path)) {
    // Wenn der Hunk nur Whitespace-Änderungen enthält, ist es Formatter.
    const nonWs = diffHunk.replace(/^[+-]\s*$/gm, "");
    if (!nonWs.includes("+") && !nonWs.includes("-")) return "formatter";
  }

  return "semantic-unknown";
}

const AUTO_REPAIRABLE: ReadonlySet<ConflictClass> = new Set([
  "formatter",
  "import-sort",
  "generated-file",
  "lockfile",
]);

const BLOCKED: ReadonlySet<ConflictClass> = new Set([
  "removed-test",
  "weakened-test",
]);

const ESCALATED: ReadonlySet<ConflictClass> = new Set([
  "public-api-change",
  "architecture-change",
  "deleted-feature",
  "contract-change",
  "schema-migration",
  "scope-expansion",
  "semantic-unknown",
]);

export function verdictFor(cls: ConflictClass): RepairVerdict {
  if (AUTO_REPAIRABLE.has(cls)) return "repaired";
  if (BLOCKED.has(cls)) return "merge-blocked";
  if (ESCALATED.has(cls)) return "escalation-required";
  return "escalation-required";
}

export function buildConflictRecord(
  path: string,
  diffHunk: string,
  detail: string,
): ConflictRecord {
  const cls = classifyConflict(path, diffHunk);

  return {
    path,
    class: cls,
    autoRepairable: AUTO_REPAIRABLE.has(cls),
    detail,
    verdict: verdictFor(cls),
  };
}
