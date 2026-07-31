import type { Atom, Evidence } from "../atoms/types";

/**
 * The serious counterweight to the report's tone (plan §8.2). Nothing here is
 * written for effect: every capability is an atom that actually matched, and
 * anything the demo cannot judge is listed as an unknown rather than guessed.
 */

/** Atoms that describe a genuine strength, not merely a peculiarity. */
const CAPABILITY_LABELS: Record<string, { label: string; detail: string }> = {
  unknown: {
    label: "Explizites Nicht-Wissen",
    detail: "Das Repository führt einen UNKNOWN-Zustand als gültige Aussage, statt Lücken zu erfinden.",
  },
  verify: {
    label: "Eigene Forensik",
    detail: "Es prüft seinen Zustand über Screenshots, Pixel- und Klassenvergleiche statt nur über Rückgabewerte.",
  },
  oracle: {
    label: "Deterministische Reihenfolge",
    detail: "Eine Instanz entscheidet, ob ein Zustand in zulässiger Reihenfolge entstanden ist.",
  },
  semantic: {
    label: "Trennung von Schein und Sein",
    detail: "Optische und physische Wirkung werden vertraglich auseinandergehalten.",
  },
  worldlaws: {
    label: "Katalogisierte Kausalität",
    detail: "Sichtbarkeit ist an mechanische Folge gebunden und vollständig aufgeschrieben.",
  },
  monopoly: {
    label: "Eine Materialwahrheit",
    detail: "Komponenten teilen eine Klassifikation, statt sich jeweils eine eigene auszudenken.",
  },
};

export interface CapabilityFinding {
  atomId: string;
  label: string;
  detail: string;
  evidence: Evidence[];
}

/**
 * Deliberately narrow. Without a license check there is no honest way to call
 * something a dependency or a fork base, so those verdicts are not offered.
 */
export type DonorRole = "donor-candidate" | "reference" | "unclear";

export interface DonorAssessment {
  role: DonorRole;
  label: string;
  reasons: string[];
  /** Always non-empty while the demo cannot read licences. */
  blockers: string[];
}

export interface ReportAssessment {
  headline: string;
  capabilities: CapabilityFinding[];
  donor: DonorAssessment;
  /** What this report could not judge, and why. */
  unknowns: string[];
}

export function capabilitiesOf(atoms: Atom[]): CapabilityFinding[] {
  return atoms
    .filter((a) => CAPABILITY_LABELS[a.id])
    .map((a) => ({
      atomId: a.id,
      label: CAPABILITY_LABELS[a.id].label,
      detail: CAPABILITY_LABELS[a.id].detail,
      evidence: a.evidence,
    }));
}

const LICENCE_BLOCKER =
  "Die Lizenz wurde nicht gelesen. Ohne sie ist keine Aussage über Übernahme, Fork oder Abhängigkeit zulässig.";

export function donorAssessment(atoms: Atom[], capabilities: CapabilityFinding[]): DonorAssessment {
  const blockers = [LICENCE_BLOCKER];

  if (atoms.length === 0) {
    return {
      role: "unclear",
      label: "Nicht beurteilbar",
      reasons: ["Keine belegten Befunde — es gibt nichts, worüber sich eine Eignung aussagen ließe."],
      blockers,
    };
  }

  if (capabilities.length >= 3) {
    return {
      role: "donor-candidate",
      label: "Donor-Kandidat",
      reasons: [
        `${capabilities.length} belegte Fähigkeiten, die sich einzeln entnehmen lassen: ${capabilities
          .map((c) => c.label)
          .join(", ")}.`,
        "Entnahme setzt eine geprüfte Lizenz und eine eigene Bewertung voraus — dieser Bericht entscheidet nichts.",
      ],
      blockers,
    };
  }

  return {
    role: "reference",
    label: "Referenz",
    reasons: [
      capabilities.length
        ? `Nur ${capabilities.length} belegte Fähigkeit${capabilities.length === 1 ? "" : "en"} — als Vorbild lesenswert, zur Entnahme zu dünn belegt.`
        : "Belegte Befunde ja, belegte Fähigkeiten nein — als Vorbild lesenswert, zur Entnahme zu dünn belegt.",
    ],
    blockers,
  };
}

export function buildAssessment(atoms: Atom[]): ReportAssessment {
  const capabilities = capabilitiesOf(atoms);
  const donor = donorAssessment(atoms, capabilities);

  const unknowns = [
    LICENCE_BLOCKER,
    "Umbenannte oder gelöschte Pfade sind aus dem abgerufenen Stand nicht ableitbar; dafür fehlt die Dateihistorie.",
    "Ob dokumentierte Funktionen tatsächlich laufen, wurde nicht ausgeführt — nur gelesen.",
  ];

  const headline =
    atoms.length === 0
      ? "Keine Regel hat gegriffen. Dieser Bericht behauptet nichts über das Repository."
      : `${atoms.length} belegte Befunde, davon ${capabilities.length} als Fähigkeit einzuordnen. Einordnung als ${donor.label}, Lizenzlage ungeprüft.`;

  return { headline, capabilities, donor, unknowns };
}
