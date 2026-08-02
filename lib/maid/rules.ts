// plan §28 — classifyWith(rules, path, size). DEFAULT_CLASSIFY_RULES,
// makeClassifier, rulesFromSettings.
// classifyPath(path, size) bleibt VERHALTENSGLEICH — der bestehende Aufrufer
// in app/api/daemon/run/route.ts ist der Kompatibilitätsbeweis.
//
// Zwei Ignore-Begriffe, die NICHT verwechselt werden dürfen:
// - maid.ignoreGlobs: Betreiber-Filter, greift VOR der Klassifikation —
//   solche Pfade erscheinen gar nicht im Report.
// - .gitignore: greift ALS SIGNAL — eine Datei, die im Git-Tree liegt,
//   obwohl die eigene .gitignore sie ausschließt, ist interessant
//   ("temporary" + das vorhandene "temporary-output"-Finding).

import type { FileClass } from "./types.js";
import { isIgnored, globToRegExp, type GitignoreRule } from "./gitignore.js";

export interface ClassifyRule {
  name: string;
  test: (path: string, size: number) => boolean;
  result: FileClass;
}

export const DEFAULT_CLASSIFY_RULES: ClassifyRule[] = [
  {
    name: "node_modules",
    test: (p) => /(^|\/)node_modules\//.test(p),
    result: "generated",
  },
  {
    name: "build-output",
    test: (p) => /(^|\/)(dist|build|\.next)\//.test(p),
    result: "generated",
  },
  {
    name: "lockfiles",
    test: (p) =>
      /^(bun\.lock|bun\.lockb|package-lock\.json|yarn\.lock)$/.test(p),
    result: "generated",
  },
  {
    name: "large-binary",
    test: (_p, size) => size > 5 * 1024 * 1024,
    result: "delete-candidate",
  },
  {
    name: "tmp-suffix",
    test: (p) => /\.(tmp|temp|bak|swp)$/.test(p),
    result: "temporary",
  },
  { name: "source-default", test: () => true, result: "active" },
];

export function classifyWith(
  rules: ClassifyRule[],
  path: string,
  size: number,
): FileClass {
  for (const rule of rules) {
    if (rule.test(path, size)) return rule.result;
  }

  return "active";
}

// Verhaltensgleicher Wrapper — bestehende Aufrufer bleiben unverändert.
export function classifyPath(path: string, size: number): FileClass {
  return classifyWith(DEFAULT_CLASSIFY_RULES, path, size);
}

export function makeClassifier(
  rules: ClassifyRule[],
): (path: string, size: number) => FileClass {
  return (path, size) => classifyWith(rules, path, size);
}

export interface MaidSettings {
  ignoreGlobs?: string[];
}

// Betreiber-Filter aus config.json — greift VOR der Klassifikation.
export function rulesFromSettings(settings: MaidSettings): ClassifyRule[] {
  const ignoreGlobs = settings.ignoreGlobs ?? [];
  const ignoreRegexes = ignoreGlobs.map((g) => globToRegExp(g));

  const ignoreRule: ClassifyRule = {
    name: "operator-ignore",
    test: (p) => ignoreRegexes.some((re) => re.test(p)),
    result: "ignored" as FileClass,
  };

  return [ignoreRule, ...DEFAULT_CLASSIFY_RULES];
}

// .gitignore als SIGNAL — nicht als Filter. Datei im Tree + eigentlich ignoriert = interessant.
export function classifyAgainstGitignore(
  path: string,
  rules: GitignoreRule[],
): "temporary" | null {
  return isIgnored(path, rules) ? "temporary" : null;
}
