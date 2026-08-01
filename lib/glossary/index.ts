// plan §36 — Glossar: zentrale Quelle für Berichte, Prompts und UI-Texte.

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "ALFRET",
    definition: "Der Name des Systems — nicht ALFRED, bewusst ohne D.",
  },
  {
    term: "Refinery",
    definition: "Die Zustandsmaschine für Merge-Bereitschaft, 15 Zustände.",
  },
  {
    term: "Repo Maid",
    definition: "Der Subsystem-Name für Klassifikation und Hygiene-Scans.",
  },
  {
    term: "Evidence",
    definition: "Belegte Beobachtung mit stabiler Referenz, nie eine Vermutung.",
  },
  {
    term: "Etappe",
    definition: "Eine abgeschlossene, testbare Bauphase dieses Plans.",
  },
  {
    term: "Raum IX",
    definition: "Interner Codename für die Architektur-Zeitmaschine.",
  },
  {
    term: "Donor",
    definition: "Ein Codeabschnitt aus der Historie als Vorlage für aktuelle Arbeit.",
  },
];

export function lookup(term: string): GlossaryEntry | undefined {
  return GLOSSARY.find((g) => g.term.toLowerCase() === term.toLowerCase());
}
