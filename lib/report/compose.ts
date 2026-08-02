import { EMPTY_SIGNALS, LEVELS, WARN } from "../atoms/data";
import { metaOrTrope, type Mode as AtomScope, type RenderedParagraph } from "../atoms/compose";
import type { Atom, AtomCategory, Signals } from "../atoms/types";
import { buildAssessment, type ReportAssessment } from "./assessment";
import { deriveBiography, type BiographyFinding, type BiographySection } from "./biography";
import { rankForRoast, roastSting } from "./roast";
import { REPORT_MODES, type Report, type ReportMode, type ReportRepoRef } from "./modes";
import { REPORT_SECTIONS, type ReportBlock, type ReportSection, type ReportSectionKey } from "./structure";

/**
 * Adapter, not an engine.
 *
 * The sentence for an atom, the tone ladder, the warning lines and the
 * paragraph/evidence model all come from `lib/atoms/*`. This file only decides
 * *which* finding belongs in *which* canonical section for a given mode, and
 * states a reason wherever a section stays empty. There is deliberately no
 * second CUE parser, no second prompt builder and no second fallback writer.
 */

/** Which atom categories feed which canonical section. */
const SECTION_CATEGORIES: Partial<Record<ReportSectionKey, readonly AtomCategory[]>> = {
  "technical-quirks": ["causality", "epistemic"],
  "institutional-oddities": ["authority", "adjudication"],
};

const BIOGRAPHY_SECTIONS: Partial<Record<ReportSectionKey, BiographySection>> = {
  "former-identity": "former-identity",
  "actual-outcome": "actual-outcome",
};

function levelParagraph(text: string): RenderedParagraph {
  return { text, cls: "cue-notag", tags: [], evidence: [] };
}

function backedParagraph(id: string, text: string, evidence: Atom["evidence"]): RenderedParagraph {
  return { text, cls: "cue-ok", tags: [{ label: id, kind: "ok" }], evidence };
}

function hypothesisParagraph(basis: string, text: string, evidence: Atom["evidence"]): RenderedParagraph {
  return { text, cls: "cue-hyp", tags: [{ label: basis, kind: "hyp" }], evidence };
}

function atomParagraph(atom: Atom, level: 1 | 2 | 3 | 4, scope: AtomScope): RenderedParagraph {
  return backedParagraph(atom.id, metaOrTrope(atom, level, scope), atom.evidence);
}

function biographyParagraph(finding: BiographyFinding): RenderedParagraph {
  return finding.kind === "hypothesis"
    ? hypothesisParagraph(finding.basis ?? "Vermutung", finding.text, finding.evidence)
    : backedParagraph(finding.id, finding.text, finding.evidence);
}

export interface ComposeReportInput {
  atoms: Atom[];
  level: 1 | 2 | 3 | 4;
  repo: ReportRepoRef;
  /** Raw signals, needed by the biography and roast rules. */
  signals?: Signals;
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

interface BuildContext {
  mode: ReportMode;
  atoms: Atom[];
  level: 1 | 2 | 3 | 4;
  scope: AtomScope;
  signals: Signals;
  assessment: ReportAssessment;
  biography: BiographyFinding[];
  repo: ReportRepoRef;
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
  const signals = input.signals ?? EMPTY_SIGNALS;
  const assessment = buildAssessment(atoms);
  const biography = deriveBiography({ signals, atoms, repoName: repo.name });

  const ctx: BuildContext = { mode, atoms, level, scope, signals, assessment, biography, repo };
  const owned = new Set<ReportSectionKey>(spec.sections);

  const sections: ReportSection[] = REPORT_SECTIONS.map((sectionSpec) => {
    const base = { key: sectionSpec.key, order: sectionSpec.order, title: sectionSpec.title };

    if (!owned.has(sectionSpec.key)) {
      return { ...base, blocks: [], emptyReason: `Nicht Teil des Modus „${spec.label}".` };
    }

    const blocks = buildBlocks(sectionSpec.key, ctx);
    const carries = blocks.some((b) => b.paragraphs.length > 0);
    return carries ? { ...base, blocks } : { ...base, blocks, emptyReason: emptyReasonFor(sectionSpec.key) };
  });

  return {
    mode,
    level,
    scope,
    repo,
    sections,
    assessment,
    atomIds: atoms.map((a) => a.id),
    createdAt: (input.now?.() ?? new Date()).toISOString(),
  };
}

function buildBlocks(key: ReportSectionKey, ctx: BuildContext): ReportBlock[] {
  const { mode, atoms, level, scope, signals, assessment, biography, repo } = ctx;
  const L = LEVELS[level];

  if (key === "opening") {
    const base = [levelParagraph(L.open), levelParagraph(L.turn)];
    if (mode === "cv") {
      const project = `${repo.owner}/${repo.name}`;
      base.push(
        levelParagraph(
          atoms.length === 0
            ? `${project} liefert nichts, was sich in einen Lebenslauf schmuggeln ließe — auch Selbstüberschätzung braucht einen Beleg.`
            : `Hiermit wird ${project} zum Lebenslaufeintrag erklärt. Nicht weil es das verdient, sondern weil ein Repository schlechter lügt als ein Anschreiben — jede Zeile unten bleibt an einen Beleg gebunden, auch wenn man dafür um die Ecke denken muss.`,
        ),
      );
    }
    return [{ paragraphs: base }];
  }

  if (key === "contradictions") {
    if (mode === "cv") {
      return [
        {
          paragraphs: [
            levelParagraph(
              "Was dieser Lebenslaufeintrag nicht behauptet, aus Prinzip und Aktenlage — jeder Personaler, der nachfragt, bekommt dieselbe Liste:",
            ),
            ...assessment.unknowns.map((u) => levelParagraph(u)),
          ],
        },
      ];
    }
    const paragraphs = [levelParagraph(L.close)];
    if (mode === "roast") {
      const sting = roastSting(atoms, signals);
      // No counted imbalance, no joke — an ordinary repository is left alone.
      if (sting) paragraphs.push(backedParagraph("roast_sting", sting.text, sting.evidence));
    }
    return [{ paragraphs, warn: WARN[level] }];
  }

  if (key === "evidence") {
    return [
      {
        paragraphs: atoms
          .filter((a) => a.evidence.length > 0)
          .map((a) => backedParagraph(a.id, a.evidence.map((e) => `${e.k}: ${e.v}`).join(" · "), a.evidence)),
      },
    ];
  }

  if (key === "surprising-strengths") {
    return [
      {
        paragraphs: assessment.capabilities.map((c) =>
          backedParagraph(c.atomId, `${c.label} — ${c.detail}`, c.evidence),
        ),
      },
    ];
  }

  if (key === "donor-fit") {
    const { donor } = assessment;
    if (atoms.length === 0) return [];
    const evidence = assessment.capabilities.flatMap((c) => c.evidence).slice(0, 4);
    return [
      {
        paragraphs: [
          // The verdict is an inference over backed capabilities, not a reading,
          // so it is marked as one.
          hypothesisParagraph(
            "aus belegten Fähigkeiten abgeleitet, Lizenz ungeprüft",
            `${donor.label}: ${donor.reasons.join(" ")}`,
            evidence,
          ),
          ...donor.blockers.map(levelParagraph),
        ],
      },
    ];
  }

  const biographySection = BIOGRAPHY_SECTIONS[key];
  if (biographySection) {
    return [{ paragraphs: biography.filter((f) => f.section === biographySection).map(biographyParagraph) }];
  }

  const categories = SECTION_CATEGORIES[key];
  if (categories) {
    const picked = atoms.filter((a) => categories.includes(a.cat));
    const ordered = mode === "roast" ? rankForRoast(picked) : picked;
    return [{ paragraphs: ordered.map((a) => atomParagraph(a, level, scope)) }];
  }

  return [];
}

function emptyReasonFor(key: ReportSectionKey): string {
  const categories = SECTION_CATEGORIES[key];
  if (categories) {
    return `Keine belegten Befunde der Kategorien ${categories.join(", ")} — hier wird nicht geraten.`;
  }
  if (key === "evidence") return "Keine Regel hat einen Beleg gefunden.";
  if (key === "surprising-strengths") return "Keiner der Befunde beschreibt eine Fähigkeit, nur Eigenheiten.";
  if (key === "donor-fit") return "Ohne belegte Befunde lässt sich über eine Eignung nichts sagen.";
  if (key === "former-identity") return "Nichts im abgerufenen Stand deutet auf eine frühere Gestalt hin.";
  if (key === "actual-outcome") return "Kein belegtes Muster, das über die reine Beschreibung hinausginge.";
  return "Keine belegte Grundlage für diesen Abschnitt.";
}
