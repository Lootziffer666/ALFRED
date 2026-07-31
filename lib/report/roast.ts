import type { Atom, AtomCategory, Evidence, Signals } from "../atoms/types";

/**
 * The roast selects and sharpens; it does not invent (plan §8.4 / §8.5).
 *
 * Sentences still come from the atoms' own tone ladder — the roast simply runs
 * at the harshest level and puts the most damning findings first. The closing
 * sting is assembled from counted facts only, and is withheld entirely when
 * the numbers are not actually lopsided, so an ordinary repository does not
 * get a generic joke at its expense.
 */

/** Bureaucracy makes the sharper case, so it leads. */
const CATEGORY_WEIGHT: Record<AtomCategory, number> = {
  authority: 0,
  adjudication: 1,
  causality: 2,
  epistemic: 3,
};

export function rankForRoast(atoms: Atom[]): Atom[] {
  return [...atoms].sort((a, b) => {
    const byCategory = CATEGORY_WEIGHT[a.cat] - CATEGORY_WEIGHT[b.cat];
    if (byCategory !== 0) return byCategory;
    const byEvidence = b.evidence.length - a.evidence.length;
    if (byEvidence !== 0) return byEvidence;
    return a.id.localeCompare(b.id);
  });
}

export interface RoastSting {
  text: string;
  evidence: Evidence[];
}

const GOVERNANCE_FILE = /^(claude\.md|architecture\.md|rules?\.md|conventions?\.md|contributing\.md|agents\.md|plan\.md)$/i;
const VERIFY_FILE = /(^|\/)(tools\/)?verify[-_.]?/i;
const NORMATIVE = /\b(invariante|darf nie|grundsatz|präzedenz|beseitigt|vertragslücke|nicht mehr zulässig)\b/i;

function countLines(text: string, predicate: (line: string) => boolean): number {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && predicate(l)).length;
}

/**
 * Only fires on a counted imbalance. Returns null — no joke at all — when the
 * repository is simply ordinary.
 */
export function roastSting(atoms: Atom[], signals: Signals): RoastSting | null {
  const ruleFiles = countLines(signals.tree, (p) => GOVERNANCE_FILE.test(p.split("/").pop() ?? ""));
  const verifyFiles = countLines(signals.tree, (p) => VERIFY_FILE.test(p));
  const verdicts = countLines(signals.commits, (l) => NORMATIVE.test(l));
  const governing = atoms.filter((a) => a.cat === "authority" || a.cat === "adjudication").length;

  const bureaucracy = ruleFiles + verifyFiles + verdicts;
  if (bureaucracy < 4 || governing < 2) return null;

  const evidence: Evidence[] = [];
  if (ruleFiles) evidence.push({ k: "Baum", v: `${ruleFiles} Regel-Dateien` });
  if (verifyFiles) evidence.push({ k: "Baum", v: `${verifyFiles} Prüfwerkzeuge` });
  if (verdicts) evidence.push({ k: "Commits", v: `${verdicts} Nachrichten in Grundsatz-Sprache` });
  evidence.push({ k: "Befunde", v: `${governing} von ${atoms.length} Befunden regeln Zuständigkeit` });

  const parts: string[] = [];
  if (ruleFiles) parts.push(`${ruleFiles} Regel-Datei${ruleFiles === 1 ? "" : "en"}`);
  if (verifyFiles) parts.push(`${verifyFiles} Prüfwerkzeug${verifyFiles === 1 ? "" : "e"}`);
  if (verdicts) parts.push(`${verdicts} Grundsatzentscheidung${verdicts === 1 ? "" : "en"} in Commit-Form`);

  return {
    text:
      `Bilanz: ${parts.join(", ")}. ` +
      `${governing} von ${atoms.length} Befunden handeln davon, wer worüber bestimmen darf — und nicht davon, was die Software tut. ` +
      `Das ist kein Projekt mehr, das ist eine Behörde mit angeschlossenem Quelltext.`,
    evidence,
  };
}
