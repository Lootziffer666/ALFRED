import type { FileClass, MaidFinding } from "./types";

/**
 * Heuristiken für die Dateiklassifikation.
 *
 * Alle Regeln sind deterministisch — keine KI, keine Vermutungen.
 * Eine Datei die keine Regel trifft, bleibt "unknown"; sie wird nicht
 * automatisch gelöscht.
 */

const GENERATED_PATTERNS = [
  /\.d\.ts$/,
  /^\.next\//,
  /^dist\//,
  /^out\//,
  /^\.turbo\//,
  /^node_modules\//,
  /package-lock\.json$/,
  /bun\.lock$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
];

const TEMPORARY_PATTERNS = [
  /\.tmp$/,
  /\.temp$/,
  /~$/,
  /\.swp$/,
  /\.orig$/,
];

const LOG_PATTERNS = [
  /\.log$/,
  /^logs\//,
];

const STALE_DOC_NAMES = [
  "CHANGELOG.md",
  "ROADMAP.md",
  "TODO.md",
  "NOTES.md",
];

export function classifyPath(
  path: string,
  sizeBytes: number,
): FileClass {
  if (GENERATED_PATTERNS.some((p) => p.test(path))) return "generated";
  if (TEMPORARY_PATTERNS.some((p) => p.test(path))) return "temporary";

  if (LOG_PATTERNS.some((p) => p.test(path))) {
    // Logs über 1 MB gelten als archive-candidate.
    return sizeBytes > 1_000_000 ? "archive-candidate" : "active";
  }

  const basename = path.split("/").pop() ?? path;
  if (STALE_DOC_NAMES.includes(basename)) return "stale";

  return "unknown";
}

/** Erzeugt ein Finding wenn ein Pfad nicht am kanonischen Ort liegt. */
export function checkLocation(
  path: string,
  expectedPrefix: string,
  observedAt: string,
): MaidFinding | null {
  if (path.startsWith(expectedPrefix)) return null;

  return {
    kind: "wrong-location",
    severity: "warning",
    path,
    detail: `Erwartet unter ${expectedPrefix}, gefunden unter ${path}.`,
    autoFixable: false,
    observedAt,
  };
}

const TODO_RE = /\bTODO\b|\bFIXME\b|\bHACK\b|\bXXX\b/;

/** Erkennt Rest-TODOs in Dateiinhalten. */
export function scanForTodos(
  path: string,
  content: string,
  observedAt: string,
): MaidFinding[] {
  const findings: MaidFinding[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (TODO_RE.test(lines[i])) {
      findings.push({
        kind: "leftover-todo",
        severity: "info",
        path: `${path}:${i + 1}`,
        detail: lines[i].trim(),
        autoFixable: false,
        observedAt,
      });
    }
  }

  return findings;
}

/** Erkennt nicht implementierte Platzhalter. */
export function scanForPlaceholders(
  path: string,
  content: string,
  observedAt: string,
): MaidFinding[] {
  const re = /\bthrow new Error\(["'`](not implemented|TODO)["'`]\)|\/\/ placeholder/gi;
  const findings: MaidFinding[] = [];
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) {
      re.lastIndex = 0;
      findings.push({
        kind: "placeholder-detected",
        severity: "warning",
        path: `${path}:${i + 1}`,
        detail: lines[i].trim(),
        autoFixable: false,
        observedAt,
      });
    }
  }

  return findings;
}
