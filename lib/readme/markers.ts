// plan §29 — Nur der markierte Block <!-- alfret:begin status --> ... <!-- alfret:end status -->
// wird ersetzt. Fehlen die Marker, wird die README NICHT angefasst
// (Default insertIfMissing: false) — der Daemon kann menschliche Prosa
// strukturell nicht verstümmeln. Der Diff bleibt trivial prüfbar,
// ein Byte-Vergleich vor dem Schreiben macht No-op-Commits unmöglich.
//
// Empfehlung, umgesetzt: gar keine LLM-Prosa für READMEs. Die veraltete
// Behauptung "Alle 11 Etappen" (die real im Repo steht, während Git bei 16+
// ist) liegt außerhalb jedes Blocks — der Daemon rührt sie nicht an,
// sondern meldet den Widerspruch als eigenes Finding (siehe Job-Datei).

const BEGIN = "<!-- alfret:begin status -->";
const END = "<!-- alfret:end status -->";

export interface MarkerReplaceResult {
  changed: boolean;
  newContent: string;
  reason: string;
}

export function replaceMarkedBlock(
  original: string,
  newBlockContent: string,
  opts: { insertIfMissing?: boolean } = {},
): MarkerReplaceResult {
  const beginIdx = original.indexOf(BEGIN);
  const endIdx = original.indexOf(END);

  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    if (!(opts.insertIfMissing ?? false)) {
      return {
        changed: false,
        newContent: original,
        reason:
          "Marker fehlen — README wird nicht angefasst (insertIfMissing=false).",
      };
    }

    const inserted = `${original.trimEnd()}\n\n${BEGIN}\n${newBlockContent}\n${END}\n`;

    return {
      changed: true,
      newContent: inserted,
      reason: "Marker eingefügt (insertIfMissing=true).",
    };
  }

  const before = original.slice(0, beginIdx + BEGIN.length);
  const after = original.slice(endIdx);
  const replaced = `${before}\n${newBlockContent}\n${after}`;

  // Byte-Vergleich vor dem Schreiben — macht No-op-Commits unmöglich.
  if (replaced === original) {
    return {
      changed: false,
      newContent: original,
      reason: "Kein inhaltlicher Unterschied — kein Commit nötig.",
    };
  }

  return { changed: true, newContent: replaced, reason: "Markierter Block ersetzt." };
}

// Erkennt den Zahlenwiderspruch ("Alle N Etappen") gegen die tatsächliche Etappenzahl aus PLAN.md.
export function findStaleEtappenClaim(
  readme: string,
  actualCount: number,
): { claimed: number; text: string } | null {
  const match = readme.match(/Alle\s+(\d+)\s+Etappen\s+abgeschlossen/i);

  if (!match) return null;

  const claimed = Number(match[1]);

  if (claimed === actualCount) return null;

  return { claimed, text: match[0] };
}
