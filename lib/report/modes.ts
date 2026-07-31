import type { Mode as AtomScope } from "../atoms/compose";
import type { ReportAssessment } from "./assessment";
import type { ReportSection, ReportSectionKey } from "./structure";

/**
 * The three report modes (plan §8.3). All three read the same atoms and the
 * same evidence; only tone, selection and emphasis differ.
 */
export type ReportMode = "pruefbericht" | "biografie" | "roast";

export type ReportModeStatus = "implemented" | "planned";

export interface ReportModeSpec {
  id: ReportMode;
  label: string;
  /** One line the UI shows when offering the mode. */
  summary: string;
  /** Tone level (LEVELS I–IV in lib/atoms/data.ts) this mode starts at. */
  defaultLevel: 1 | 2 | 3 | 4;
  /** Sections this mode is responsible for filling. */
  sections: readonly ReportSectionKey[];
  /**
   * Whether the mode actually renders yet. A `planned` mode is never composed
   * as if it worked — the registry states the intended shape without claiming
   * the implementation exists.
   */
  status: ReportModeStatus;
}

/**
 * Sections every mode carries. The tone is what varies between modes; the
 * serious reading — capabilities, donor fit and the evidence behind them —
 * is shown on every run (plan §8.2).
 */
const SERIOUS_SECTIONS = [
  "opening",
  "contradictions",
  "surprising-strengths",
  "donor-fit",
  "evidence",
] as const satisfies readonly ReportSectionKey[];

export const REPORT_MODES: Record<ReportMode, ReportModeSpec> = {
  pruefbericht: {
    id: "pruefbericht",
    label: "Prüfbericht",
    summary: "Trocken, institutionell und zunehmend absurd — über die Tonstufen I–IV.",
    defaultLevel: 1,
    sections: [...SERIOUS_SECTIONS, "technical-quirks", "institutional-oddities"],
    status: "implemented",
  },
  biografie: {
    id: "biografie",
    label: "Repo-Biografie",
    summary: "Wie sich das Repository von seiner ursprünglichen Idee zum heutigen Zustand entwickelt hat.",
    defaultLevel: 2,
    sections: [...SERIOUS_SECTIONS, "former-identity", "actual-outcome"],
    status: "implemented",
  },
  roast: {
    id: "roast",
    label: "Roast mit Belegen",
    summary: "Direkt und hart, aber konkret, fair und an Evidence gebunden.",
    defaultLevel: 4,
    sections: [...SERIOUS_SECTIONS, "technical-quirks", "institutional-oddities"],
    status: "implemented",
  },
};

export const REPORT_MODE_IDS = Object.keys(REPORT_MODES) as ReportMode[];

export function isReportMode(value: unknown): value is ReportMode {
  return typeof value === "string" && value in REPORT_MODES;
}

export function implementedModes(): ReportModeSpec[] {
  return REPORT_MODE_IDS.map((id) => REPORT_MODES[id]).filter((m) => m.status === "implemented");
}

export interface ReportRepoRef {
  owner: string;
  name: string;
  ref?: string;
}

export interface Report {
  mode: ReportMode;
  /** Tone level actually used. */
  level: 1 | 2 | 3 | 4;
  /** Single repository or archive-wide, as understood by the atom engine. */
  scope: AtomScope;
  repo: ReportRepoRef;
  /** All fifteen canonical sections, in order, filled or with an empty reason. */
  sections: ReportSection[];
  /** The tone-free reading: capabilities, donor fit, and what stayed unjudged. */
  assessment: ReportAssessment;
  /** The atoms that backed this report — its only factual basis. */
  atomIds: string[];
  createdAt: string;
}
