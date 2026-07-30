import { LEVELS, PHASES, WARN } from "./data";
import type { Atom, Evidence, Signals } from "./types";

export type Mode = "single" | "meta";

export interface Assessment {
  domains: string[];
  role: string;
  prio: string;
  license: string;
  repo: string;
}

export interface RenderedTag {
  label: string;
  kind: "ok" | "hyp" | "bad";
}

export type ParagraphClass = "cue-ok" | "cue-hyp" | "cue-bad" | "cue-notag";

export interface RenderedParagraph {
  text: string;
  cls: ParagraphClass;
  tags: RenderedTag[];
  evidence: Evidence[];
}

export interface RenderedPhase {
  index: number;
  title: string;
  levelName: string;
  mode: "fallback" | "ki";
  banner?: string;
  paragraphs: RenderedParagraph[];
  warn?: string;
  empty?: boolean;
}

export function metaOrTrope(a: Atom, level: 1 | 2 | 3 | 4, mode: Mode): string {
  return mode === "meta" && a.metaSentence ? a.metaSentence : a.trope[level];
}

export function aktenBanner(opts: {
  mode: Mode;
  metaTotal: number;
  dbFileNames: string[];
  assess: Assessment | null;
}): string | undefined {
  const { mode, metaTotal, dbFileNames, assess } = opts;
  if (mode === "meta") {
    return `Meta-Ausleuchtung über ${metaTotal} Repos aus ${dbFileNames.length ? dbFileNames.join(", ") : "Demo"}.`;
  }
  if (!assess) return undefined;
  const parts: string[] = [];
  if (assess.domains.length) parts.push(`Domänen: ${assess.domains.join(", ")}`);
  if (assess.role) parts.push(`Rolle: ${assess.role}`);
  if (assess.prio) parts.push(`Priorität: ${assess.prio}`);
  if (assess.license) parts.push(`Lizenz: ${assess.license}`);
  if (!parts.length) return undefined;
  return `${parts.join(" · ")} — zu „${assess.repo}". Nicht inferiert, sondern übernommen.`;
}

function atomById(atoms: Atom[], id: string): Atom | undefined {
  return atoms.find((a) => a.id === id);
}

export function composeFallback(opts: {
  atoms: Atom[];
  level: 1 | 2 | 3 | 4;
  mode: Mode;
  metaTotal: number;
  dbFileNames: string[];
  assess: Assessment | null;
}): RenderedPhase[] {
  const { atoms, level, mode, metaTotal, dbFileNames, assess } = opts;
  const L = LEVELS[level];
  const banner = aktenBanner({ mode, metaTotal, dbFileNames, assess });

  return PHASES.map((ph, pi) => {
    if (ph.lvlKey === "open") {
      return {
        index: pi,
        title: ph.title,
        levelName: `${L.name} · Fallback`,
        mode: "fallback",
        banner,
        paragraphs: [
          { text: L.open, cls: "cue-notag", tags: [], evidence: [] },
          { text: L.turn, cls: "cue-notag", tags: [], evidence: [] },
        ],
      };
    }
    if (ph.lvlKey === "close") {
      return {
        index: pi,
        title: ph.title,
        levelName: `${L.name} · Fallback`,
        mode: "fallback",
        paragraphs: [{ text: L.close, cls: "cue-notag", tags: [], evidence: [] }],
        warn: WARN[level],
      };
    }
    const picked = ph.pick.map((id) => atomById(atoms, id)).filter((a): a is Atom => !!a);
    if (!picked.length) {
      return { index: pi, title: ph.title, levelName: `${L.name} · Fallback`, mode: "fallback", paragraphs: [], empty: true };
    }
    return {
      index: pi,
      title: ph.title,
      levelName: `${L.name} · Fallback`,
      mode: "fallback",
      paragraphs: picked.map((a) => ({
        text: metaOrTrope(a, level, mode),
        cls: "cue-ok" as const,
        tags: [],
        evidence: a.evidence,
      })),
    };
  });
}

function atomContextForLLM(atoms: Atom[]): string {
  return atoms.map((a) => `- [[${a.id}]] (${a.cat}): ${a.evidence.map((e) => e.v).join(" | ")}`).join("\n");
}

export function buildPrompts(opts: {
  atoms: Atom[];
  level: 1 | 2 | 3 | 4;
  mode: Mode;
  signals: Signals;
  assess: Assessment | null;
}): { system: string; user: string } {
  const { atoms, level, mode, signals, assess } = opts;
  const L = LEVELS[level];
  const system = `Du bist ein literarischer Software-Auditor. Stil: ${L.stil}
Schreibe einen zusammenhängenden Prüfbericht in genau 5 Abschnitten mit diesen Überschriften (je eine Zeile "## "):
## Der Schein der Oberfläche
## Die Verfassung
## Die Behördenstruktur
## Paradoxa & ehrliches Nicht-Wissen
## Quintessenz

HARTE REGELN (CUE-Agent prüft danach):
1. Unten stehen belegte Befunde ("Atome") mit Belegen – deine EINZIGE Faktenbasis.${mode === "meta" ? " Die Belege sind Archiv-Häufigkeiten; sprich über das Archiv als Ganzes." : ""}
2. Hinter JEDEN Absatz, der einen Befund nutzt, setze dessen Tags, z.B. [[monopoly]] [[marker]].
3. Erfinde KEINE Fakten, die nicht in Atomen/Signalen stehen. Vermutetes → [[?HYP: Grund]].
4. "Der Schein der Oberfläche" beginnt mit: ${L.open} Dann: ${L.turn}
   "Quintessenz" endet mit: ${L.close} Danach eine Zeile: WARNHINWEIS: <prägnanter, überspitzter Satz>.
5. Dicht, bildhaft, im Ton. Keine Aufzählungen, keine Meta-Kommentare, keine weiteren Überschriften.

BELEGTE BEFUNDE:
${atomContextForLLM(atoms)}

ROH-SIGNALE (Kontext, keine neuen Fakten daraus):
README: ${signals.readme}
VERFASSUNG: ${signals.const}
ORDNER: ${signals.tree}
COMMITS/PRS: ${signals.commits}
KONVENTIONEN: ${signals.conv}${assess ? `\nASSESSMENT (vom Nutzer, nicht erfinden, höchstens einordnen): ${JSON.stringify(assess)}` : ""}`;

  const user = `Schreibe jetzt den vollständigen Bericht (Stufe: ${L.name}${mode === "meta" ? ", über das ganze Archiv" : ""}).`;
  return { system, user };
}

interface ParsedSection {
  title: string;
  paragraphs: RenderedParagraph[];
  warn?: string;
}

export interface ParseKIResult {
  sections: ParsedSection[];
  unused: Atom[];
  kiCount: number;
  badCount: number;
}

/** Parses raw model text into CUE-audited sections/paragraphs. Pure — no network, no DOM. */
export function parseKI(text: string, atoms: Atom[]): ParseKIResult {
  interface RawSection {
    title: string;
    lines: string[];
  }
  const rawSections: RawSection[] = [];
  let current: RawSection | null = null;
  for (const line of text.split("\n")) {
    const heading = line.match(/^##\s*(.+)/);
    if (heading) {
      current = { title: heading[1].trim(), lines: [] };
      rawSections.push(current);
      continue;
    }
    if (!current) {
      current = { title: "", lines: [] };
      rawSections.push(current);
    }
    const trimmed = line.trim();
    if (trimmed) current.lines.push(trimmed);
  }

  const used = new Set<string>();
  let kiCount = 0;
  let badCount = 0;

  const sections: ParsedSection[] = rawSections.map((raw) => {
    let warn: string | undefined;
    const paragraphs: RenderedParagraph[] = [];
    for (const line of raw.lines) {
      const warnMatch = line.match(/^WARNHINWEIS:\s*(.+)/i);
      if (warnMatch) {
        warn = warnMatch[1];
        continue;
      }
      const tagMatches = [...line.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]);
      const clean = line.replace(/\s*\[\[[^\]]+\]\]\s*/g, "").trim();
      if (!clean) continue;

      const atomTags = tagMatches.filter((t) => !t.startsWith("?") && atomById(atoms, t));
      const hypTags = tagMatches.filter((t) => t.startsWith("?"));
      const badTags = tagMatches.filter((t) => !t.startsWith("?") && !atomById(atoms, t));
      atomTags.forEach((t) => used.add(t));

      let cls: ParagraphClass;
      let tags: RenderedTag[] = [];
      let evidence: Evidence[] = [];

      if (badTags.length) {
        cls = "cue-bad";
        badCount++;
        tags = badTags.map((t) => ({ label: t, kind: "bad" }));
      } else if (atomTags.length) {
        cls = "cue-ok";
        kiCount++;
        evidence = atomTags.flatMap((t) => atomById(atoms, t)?.evidence ?? []).slice(0, 4);
        tags = atomTags.map((t) => ({ label: t, kind: "ok" }));
      } else if (hypTags.length) {
        cls = "cue-hyp";
        kiCount++;
        tags = hypTags.map((t) => ({ label: t.replace(/^\?HYP:\s*/, ""), kind: "hyp" }));
      } else {
        cls = "cue-notag";
      }

      paragraphs.push({ text: clean, cls, tags, evidence });
    }
    return { title: raw.title, paragraphs, warn };
  });

  return {
    sections,
    unused: atoms.filter((a) => !used.has(a.id)),
    kiCount,
    badCount,
  };
}

const SECTION_HINTS: Record<string, RegExp> = {
  schein: /schein|oberfläche|vorgibt/,
  verfass: /verfassung|vertrag|invariante/,
  behörd: /behörde|revision|forensik|rechtsprech|commit|prüf/,
  para: /paradox|nicht.?wissen|unknown|kausal|weltgesetz|ehrlich/,
  quint: /quintessenz|fazit|zusammen/,
};

/** Maps parsed sections onto the fixed 5 PHASES slots by heading-keyword hints, falling back to slot order. */
export function mapSectionsToPhases(sections: ParsedSection[]): (ParsedSection | null)[] {
  const keys = ["schein", "verfass", "behörd", "para", "quint"];
  const out: (ParsedSection | null)[] = [null, null, null, null, null];
  const used = new Set<number>();

  sections.forEach((sec) => {
    const t = sec.title.toLowerCase();
    let best = -1;
    keys.forEach((k, i) => {
      if (SECTION_HINTS[k].test(t)) best = i;
    });
    if (best < 0) best = out.findIndex((x) => x === null);
    if (best >= 0 && !used.has(best)) {
      out[best] = sec;
      used.add(best);
    } else {
      const free = out.findIndex((x) => x === null);
      if (free >= 0) {
        out[free] = sec;
        used.add(free);
      }
    }
  });

  return out;
}

export function renderAudited(opts: {
  sections: ParsedSection[];
  atoms: Atom[];
  level: 1 | 2 | 3 | 4;
  mode: Mode;
  metaTotal: number;
  dbFileNames: string[];
  assess: Assessment | null;
}): RenderedPhase[] {
  const { sections, atoms, level, mode, metaTotal, dbFileNames, assess } = opts;
  const byIndex = mapSectionsToPhases(sections);
  const fallback = composeFallback({ atoms, level, mode, metaTotal, dbFileNames, assess });
  const banner = aktenBanner({ mode, metaTotal, dbFileNames, assess });

  return PHASES.map((ph, pi) => {
    const sec = byIndex[pi];
    if (!sec) return fallback[pi];
    return {
      index: pi,
      title: ph.title,
      levelName: `${LEVELS[level].name} · KI`,
      mode: "ki",
      banner: pi === 0 ? banner : undefined,
      paragraphs: sec.paragraphs,
      warn: ph.lvlKey === "close" ? sec.warn ?? WARN[level] : undefined,
    };
  });
}
