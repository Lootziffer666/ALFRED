import { LEVELS, WARN } from "../atoms/data";
import { metaOrTrope, type Mode as AtomScope, type RenderedParagraph } from "../atoms/compose";
import type { Atom, AtomCategory } from "../atoms/types";
import { REPORT_MODES, type Report, type ReportMode, type ReportRepoRef } from "./modes";
import { REPORT_SECTIONS, type ReportBlock, type ReportSection, type ReportSectionKey } from "./structure";

/**
 * Adapter, not an engine.
 *
 * The sentence for an atom, the tone ladder, the warning lines and the
 * paragraph/evidence model all come from `lib/atoms/*`. This file only decides
 * *which* atom belongs in *which* canonical section, and states a reason
 * wherever a section stays empty. There is deliberately no second CUE parser,
 * no second prompt builder and no second fallback writer here.
 */

/** Which atom categories feed which canonical section, per mode. */
const SECTION_CATEGORIES: Partial<Record<ReportSectionKey, readonly AtomCategory[]>> = {
  "technical-quirks": ["causality", "epistemic"],
  "institutional-oddities": ["authority", "adjudication"],
};

function levelParagraph(text: string): RenderedParagraph {
  return { text, cls: "cue-notag", tags: [], evidence: [] };
}

function atomParagraph(atom: Atom, level: 1 | 2 | 3 | 4, scope: AtomScope): RenderedParagraph {
  return {
    text: metaOrTrope(atom, level, scope),
    cls: "cue-ok",
    tags: [{ label: atom.id, kind: "ok" }],
    evidence: atom.evidence,
  };
}

function evidenceParagraph(atom: Atom): RenderedParagraph {
  return {
    text: atom.evidence.map((e) => `${e.k}: ${e.v}`).join(" · "),
    cls: "cue-ok",
    tags: [{ label: atom.id, kind: "ok" }],
    evidence: atom.evidence,
  };
}

export interface ComposeReportInput {
  atoms: Atom[];
  level: 1 | 2 | 3 | 4;
  repo: ReportRepoRef;
  /** "single" for one repository, "meta" for an archive-wide reading. */
  scope?: AtomScope;
  /** Injectable for deterministic tests. */
  now?: () => Date;
}

export class UnimplementedReportModeError extends Error {
  constructor(mode: ReportMode) {
    super(
      `Report mode "${mode}" is declared but not implemented yet (status: planned). ` +
        `Compose it only once its stage has landed.`,
    );
    this.name = "UnimplementedReportModeError";
  }
}

/**
 * Builds the canonical report for a mode. Deterministic and network-free: the
 * public demo must produce a full report with no model involved (plan §8.7).
 */
export function composeReport(mode: ReportMode, input: ComposeReportInput): Report {
  const spec = REPORT_MODES[mode];
  if (spec.status !== "implemented") throw new UnimplementedReportModeError(mode);

  const { atoms, level, repo } = input;
  const scope: AtomScope = input.scope ?? "single";
  const owned = new Set<ReportSectionKey>(spec.sections);

  const sections: ReportSection[] = REPORT_SECTIONS.map((sectionSpec) => {
    const base = { key: sectionSpec.key, order: sectionSpec.order, title: sectionSpec.title };

    if (!owned.has(sectionSpec.key)) {
      return { ...base, blocks: [], emptyReason: `Nicht Teil des Modus „${spec.label}".` };
    }

    const blocks = buildBlocks(sectionSpec.key, { atoms, level, scope });
    const carries = blocks.some((b) => b.paragraphs.length > 0);
    return carries ? { ...base, blocks } : { ...base, blocks, emptyReason: emptyReasonFor(sectionSpec.key) };
  });

  return {
    mode,
    level,
    scope,
    repo,
    sections,
    atomIds: atoms.map((a) => a.id),
    createdAt: (input.now?.() ?? new Date()).toISOString(),
  };
}

function buildBlocks(
  key: ReportSectionKey,
  ctx: { atoms: Atom[]; level: 1 | 2 | 3 | 4; scope: AtomScope },
): ReportBlock[] {
  const { atoms, level, scope } = ctx;
  const L = LEVELS[level];

  if (key === "opening") {
    return [{ paragraphs: [levelParagraph(L.open), levelParagraph(L.turn)] }];
  }

  if (key === "contradictions") {
    return [{ paragraphs: [levelParagraph(L.close)], warn: WARN[level] }];
  }

  if (key === "evidence") {
    return [{ paragraphs: atoms.filter((a) => a.evidence.length > 0).map(evidenceParagraph) }];
  }

  const categories = SECTION_CATEGORIES[key];
  if (categories) {
    const picked = atoms.filter((a) => categories.includes(a.cat));
    return [{ paragraphs: picked.map((a) => atomParagraph(a, level, scope)) }];
  }

  return [];
}

function emptyReasonFor(key: ReportSectionKey): string {
  const categories = SECTION_CATEGORIES[key];
  if (categories) {
    return `Keine belegten Befunde der Kategorien ${categories.join(", ")} — hier wird nicht geraten.`;
  }
  if (key === "evidence") return "Keine Regel hat einen Beleg gefunden.";
  return "Keine belegte Grundlage für diesen Abschnitt.";
}
