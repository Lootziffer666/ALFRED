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
  /**
   * Wie `regex`, verlangt aber mindestens ein weiteres Pfadsegment. Ein
   * Verzeichnis-Muster (`node_modules/`) trifft nämlich nicht nur das
   * Verzeichnis selbst, sondern alles darunter — auch wenn man nur den
   * Dateipfad kennt und nicht weiß, dass ein Elternteil ein Verzeichnis ist.
   */
  descendantRegex: RegExp;
}

/** Baut den Regex-Rumpf einmal, damit beide Varianten identisch übersetzen. */
function compileGlob(glob: string): { prefix: string; body: string } {
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

  return { prefix: anchored ? "^" : "^(.*/)?", body: out };
}

export function globToRegExp(glob: string): RegExp {
  const { prefix, body } = compileGlob(glob);
  return new RegExp(`${prefix}${body}(/.*)?$`);
}

function descendantRegExp(glob: string): RegExp {
  const { prefix, body } = compileGlob(glob);
  return new RegExp(`${prefix}${body}/.+$`);
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
      descendantRegex: descendantRegExp(pattern),
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
    // `node_modules/` trifft das Verzeichnis — und damit auch jede Datei
    // darunter. Für einen Nicht-Verzeichnis-Pfad zählt deshalb nur ein Treffer
    // auf einem Elternteil, nicht auf dem Pfad selbst.
    const matches =
      rule.dirOnly && !isDirectory
        ? rule.descendantRegex.test(path)
        : rule.regex.test(path);

    if (matches) {
      ignored = !rule.negated;
    }
  }

  return ignored;
}
