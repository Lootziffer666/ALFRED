import type { RenderedParagraph } from "../atoms/compose";

/**
 * The canonical report structure (plan §8.4). Every report mode renders into
 * these same fifteen sections — a mode changes tone and selection, never the
 * shape of the report.
 */
export type ReportSectionKey =
  | "opening"
  | "former-identity"
  | "actual-outcome"
  | "technical-quirks"
  | "institutional-oddities"
  | "surprising-strengths"
  | "contradictions"
  | "present"
  | "partially-present"
  | "documented-only"
  | "unproven"
  | "donor-fit"
  | "evidence"
  | "iceberg"
  | "cta";

export interface ReportSectionSpec {
  key: ReportSectionKey;
  /** 1-based position in the canonical structure. */
  order: number;
  title: string;
}

export const REPORT_SECTIONS: readonly ReportSectionSpec[] = [
  { key: "opening", order: 1, title: "Eröffnung" },
  { key: "former-identity", order: 2, title: "Was dieses Repository vermutlich einmal war" },
  { key: "actual-outcome", order: 3, title: "Was daraus tatsächlich geworden ist" },
  { key: "technical-quirks", order: 4, title: "Technische Eigenheiten" },
  { key: "institutional-oddities", order: 5, title: "Institutionelle Merkwürdigkeiten" },
  { key: "surprising-strengths", order: 6, title: "Überraschend starke Fähigkeiten" },
  { key: "contradictions", order: 7, title: "Widersprüche" },
  { key: "present", order: 8, title: "Tatsächlich vorhanden" },
  { key: "partially-present", order: 9, title: "Teilweise vorhanden" },
  { key: "documented-only", order: 10, title: "Nur dokumentiert" },
  { key: "unproven", order: 11, title: "Nicht belegt" },
  { key: "donor-fit", order: 12, title: "Donor-Eignung" },
  { key: "evidence", order: 13, title: "Evidence" },
  { key: "iceberg", order: 14, title: "ALFRET-Eisberg" },
  { key: "cta", order: 15, title: "CTA" },
] as const;

export function sectionSpec(key: ReportSectionKey): ReportSectionSpec {
  const spec = REPORT_SECTIONS.find((s) => s.key === key);
  if (!spec) throw new Error(`Unknown report section: ${key}`);
  return spec;
}

/**
 * A run of paragraphs inside a section. Paragraphs are the *same*
 * `RenderedParagraph` the atom engine produces, so the CUE classification and
 * evidence attached by `lib/atoms/compose.ts` survive into the report
 * untouched — there is no second paragraph model.
 */
export interface ReportBlock {
  /** Optional sub-heading when one section carries several distinct runs. */
  title?: string;
  paragraphs: RenderedParagraph[];
  banner?: string;
  warn?: string;
}

export interface ReportSection {
  key: ReportSectionKey;
  order: number;
  title: string;
  blocks: ReportBlock[];
  /**
   * Why this section carries nothing. A section is never silently dropped:
   * an empty section states its reason instead of implying "nothing found".
   */
  emptyReason?: string;
}

export function isEmpty(section: ReportSection): boolean {
  return section.blocks.every((b) => b.paragraphs.length === 0);
}
