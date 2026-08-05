// plan §28 — scanRepository(input, now): MaidReport. Rein, kein I/O.
// Test-Fixture ist die eigene .gitignore: enthält node_modules, .next, .env,
// !.env.example, !.yarn/patches, *.tsbuildinfo — also Anker, Dir-only,
// Wildcard und Negation-nach-Wildcard (die klassische Falle: .env.example
// muss wieder unignoriert werden).

import type { MaidReport, MaidFinding } from "./types";
import {
  classifyWith,
  rulesFromSettings,
  classifyAgainstGitignore,
} from "./rules";
import { parseGitignore } from "./gitignore";
import type { MaidSettings } from "./rules";

export interface ScanInput {
  repository: string;
  commitSha: string;
  files: Array<{ path: string; size: number }>;
  gitignoreContent: string | null;
  settings: MaidSettings;
}

export function scanRepository(
  input: ScanInput,
  now: () => Date = () => new Date(),
): MaidReport {
  const rules = rulesFromSettings(input.settings);
  const gitignoreRules = input.gitignoreContent
    ? parseGitignore(input.gitignoreContent)
    : [];

  const classifiedFiles: Record<string, string> = {};
  const findings: MaidFinding[] = [];
  const nowIso = now().toISOString();

  for (const file of input.files) {
    const cls = classifyWith(rules, file.path, file.size);
    classifiedFiles[file.path] = cls;

    // .gitignore als Signal — unabhängig von der Klassifikation oben.
    const gitignoreSignal = classifyAgainstGitignore(file.path, gitignoreRules);

    if (gitignoreSignal === "temporary") {
      findings.push({
        kind: "temporary-output",
        severity: "info",
        path: file.path,
        detail: "Datei liegt im Git-Tree, obwohl .gitignore sie ausschließt.",
        autoFixable: false,
        observedAt: nowIso,
      });
    }

    if (cls === "delete-candidate") {
      findings.push({
        kind: "temporary-output",
        severity: "warning",
        path: file.path,
        detail: "Große Binärdatei — Löschkandidat.",
        autoFixable: false,
        observedAt: nowIso,
      });
    }
  }

  return {
    repository: input.repository,
    commitSha: input.commitSha,
    findings,
    proposals: [],
    classifiedFiles: classifiedFiles as never,
    runAt: nowIso,
  };
}
