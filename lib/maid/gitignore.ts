// plan §28 — Minimaler .gitignore-Matcher, ohne Abhängigkeit.
// Unterstützt: Kommentare (#), !-Negation (last-match-wins), /-Suffix (Verzeichnis-only),
// Anker (führendes /), *, ?, **, Zeichenklassen [...].
// AUSDRÜCKLICH NICHT unterstützt (im Modulkopf dokumentiert): verschachtelte
// .gitignore-Dateien, .git/info/exclude, core.excludesFile.

export interface GitignoreRule {
  pattern: string;
  negated: boolean;
  dirOnly: boolean;
  anchored: boolean;
  regex: RegExp;
}

export function globToRegExp(glob: string): RegExp {
  let pattern = glob;
  let anchored = false;
  if (pattern.startsWith("/")) {
    anchored = true;
    pattern = pattern.slice(1);
  }

  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*" && pattern[i + 1] === "*") {
      out += ".*";
      i++;
      if (pattern[i + 1] === "/") i++;
    } else if (c === "*") {
      out += "[^/]*";
    } else if (c === "?") {
      out += "[^/]";
    } else if (c === "[") {
      const close = pattern.indexOf("]", i);
      if (close === -1) {
        out += "\\[";
      } else {
        out += pattern.slice(i, close + 1);
        i = close;
      }
    } else if (".+^${}()|\\".includes(c)) {
      out += "\\" + c;
    } else {
      out += c;
    }
  }

  const prefix = anchored ? "^" : "^(.*/)?";
  return new RegExp(`${prefix}${out}(/.*)?$`);
}

export function parseGitignore(content: string): GitignoreRule[] {
  const rules: GitignoreRule[] = [];
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith("#")) continue;

    let pattern = line;
    let negated = false;
    if (pattern.startsWith("!")) {
      negated = true;
      pattern = pattern.slice(1);
    }

    let dirOnly = false;
    if (pattern.endsWith("/") && pattern.length > 1) {
      dirOnly = true;
      pattern = pattern.slice(0, -1);
    }

    const anchored = pattern.startsWith("/") || pattern.includes("/");

    rules.push({
      pattern,
      negated,
      dirOnly,
      anchored,
      regex: globToRegExp(pattern),
    });
  }

  return rules;
}

// last-match-wins: die letzte passende Regel entscheidet, egal ob negiert.
export function isIgnored(
  path: string,
  rules: GitignoreRule[],
  isDirectory = false,
): boolean {
  let ignored = false;
  for (const rule of rules) {
    if (rule.dirOnly && !isDirectory) continue;

    if (rule.regex.test(path)) {
      ignored = !rule.negated;
    }
  }

  return ignored;
}
