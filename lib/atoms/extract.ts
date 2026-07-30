import { RULES } from "./data";
import type { Atom, Signals } from "./types";

/**
 * The prototype HTML calls `extract(signals)` in several places but never
 * defines it — every other function's usage (a.id/a.cat/a.evidence/a.trope,
 * consumed identically to a RULES entry with `hyp:false`) makes the intent
 * unambiguous: run every rule's `scan` against the signals and keep the
 * ones that found evidence.
 */
export function extract(signals: Signals): Atom[] {
  const atoms: Atom[] = [];
  for (const rule of RULES) {
    const evidence = rule.scan(signals);
    if (!evidence) continue;
    atoms.push({ id: rule.id, cat: rule.cat, evidence, trope: rule.trope, hyp: false });
  }
  return atoms;
}

export interface MetaAtomInput {
  counts: Record<string, number>;
  samples: Record<string, string[]>;
  total: number;
}

/** Aggregates per-repo extraction results into archive-wide ("meta") atoms. */
export function buildMetaAtoms({ counts, samples, total }: MetaAtomInput): Atom[] {
  return RULES.filter((r) => counts[r.id]).map((r) => {
    const count = counts[r.id];
    const pct = Math.round((count / total) * 100);
    const sample = samples[r.id] ?? [];
    const evidence = [{ k: "ARCHIV", v: `${count}/${total} Repos (${pct}%) · z.B. ${sample.join(", ")}` }];
    const weight = pct > 50 ? "Eine Mehrheit, also eher Konvention als Ausnahme." : pct > 15 ? "Eine Minderheit mit Gewicht – ein wiederkehrendes Muster." : "Ein Einzelfall-Signal, das im Archiv trotzdem eine Spur hinterlässt.";
    const metaSentence = `In *${pct}%* des Archivs (${count} von ${total} Repos) tritt dieser Befund auf – belegt u.a. durch ${sample.join(", ")}. ${weight}`;
    return { id: r.id, cat: r.cat, evidence, trope: r.trope, hyp: false, metaSentence, count, pct };
  });
}
