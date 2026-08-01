/**
 * PR-Commit-Gate (Etappe 15e).
 *
 * Prüfung vor Merge-Simulation. Schaut auf Commit-Message, PR-Titel,
 * PR-Body und prüft auf verdächtige Patterns.
 *
 * Zielt darauf ab, offensichtliche Fehler früh zu erkennen bevor
 * die aufwändigere Merge-Simulation läuft.
 */

export interface PrAssessment {
  prId: string;
  titleValid: boolean;
  bodyValid: boolean;
  scopeAcceptable: boolean;
  suspiciousPatterns: string[];
  passed: boolean;
  issues: string[];
  assessedAt: string;
}

const SUSPICIOUS_PATTERNS = [
  /TODO.*fix/i,
  /FIXME.*debug/i,
  /WIP\s+/i,
  /console\.(log|debug)/,
  /\bXXX\b/,
  /\bhack\b/i,
  /\bkludge\b/i,
];

const MIN_TITLE_LENGTH = 10;
const MAX_TITLE_LENGTH = 100;
const MAX_SCOPE_LINES = 500;

export function assessCommitForPr(
  prId: string,
  title: string,
  body: string,
  files: string[],
): PrAssessment {
  const issues: string[] = [];
  const suspiciousPatterns: string[] = [];

  // ── PR-Titel ────────────────────────────────────────────────────────────
  let titleValid = false;
  if (!title || title.length === 0) {
    issues.push("PR-Titel ist leer.");
  } else if (title.length < MIN_TITLE_LENGTH) {
    issues.push(`PR-Titel zu kurz (${title.length} < ${MIN_TITLE_LENGTH} Zeichen).`);
  } else if (title.length > MAX_TITLE_LENGTH) {
    issues.push(`PR-Titel zu lang (${title.length} > ${MAX_TITLE_LENGTH} Zeichen).`);
  } else {
    titleValid = true;
  }

  // ── PR-Body ─────────────────────────────────────────────────────────────
  let bodyValid = false;
  if (!body || body.length === 0) {
    issues.push("PR-Body ist leer.");
  } else if (body.length < 20) {
    issues.push(`PR-Body zu kurz (${body.length} < 20 Zeichen).`);
  } else {
    bodyValid = true;
  }

  // ── Scope-Kontrolle ──────────────────────────────────────────────────────
  let scopeAcceptable = true;
  if (files.length > 50) {
    issues.push(`Zu viele Dateien geändert (${files.length} > 50).`);
    scopeAcceptable = false;
  }

  const changedLines = body.split("\n").length;
  if (changedLines > MAX_SCOPE_LINES) {
    issues.push(`Zu viele geänderte Zeilen (${changedLines} > ${MAX_SCOPE_LINES}).`);
    scopeAcceptable = false;
  }

  // ── Verdächtige Muster ───────────────────────────────────────────────────
  const combinedText = `${title}\n${body}`;
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(combinedText)) {
      suspiciousPatterns.push(pattern.source);
    }
  }

  if (suspiciousPatterns.length > 0) {
    issues.push(
      `Verdächtige Patterns gefunden: ${suspiciousPatterns.join(", ")}`,
    );
  }

  const passed = titleValid && bodyValid && scopeAcceptable && suspiciousPatterns.length === 0;

  return {
    prId,
    titleValid,
    bodyValid,
    scopeAcceptable,
    suspiciousPatterns,
    passed,
    issues,
    assessedAt: new Date().toISOString(),
  };
}
