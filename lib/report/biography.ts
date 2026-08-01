import type { Atom, Evidence, Signals } from "../atoms/types";

/**
 * Sections 2 and 3 of the canonical structure: what the repository probably
 * once was, and what it actually became (plan §8.3).
 *
 * Same registry shape as `lib/atoms/data.ts` — a rule either finds something
 * and returns it with its evidence, or returns null. Anything inferred rather
 * than read stays a hypothesis and says on what basis it was guessed; it is
 * never promoted to a finding.
 */

export type BiographySection = "former-identity" | "actual-outcome";

export interface BiographyMatch {
  kind: "backed" | "hypothesis";
  text: string;
  evidence: Evidence[];
  /** For a hypothesis: what makes this a guess rather than a reading. */
  basis?: string;
}

export interface BiographyContext {
  signals: Signals;
  atoms: Atom[];
  repoName: string;
}

export interface BiographyRule {
  id: string;
  section: BiographySection;
  scan: (ctx: BiographyContext) => BiographyMatch | null;
}

export interface BiographyFinding extends BiographyMatch {
  id: string;
  section: BiographySection;
}

function lines(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

function matchingLines(text: string, pattern: RegExp): string[] {
  return lines(text).filter((l) => pattern.test(l));
}

function treePaths(signals: Signals): string[] {
  return lines(signals.tree);
}

function excerpt(line: string, max = 64): string {
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

const PROTOTYPE = /prototyp|prototype|mockup|single[- ]?file|erste fassung|v0\b|proof of concept|portiert|ported from/i;
const RENAMED = /\b(früher|ehemals|vormals|hieß|umbenannt|formerly|renamed|previously known as)\b/i;
const NORMATIVE = /\b(invariante|darf nie|grundsatz|präzedenz|beseitigt|vertragslücke|nicht mehr zulässig)\b/i;
const GOVERNANCE_FILE = /^(claude\.md|architecture\.md|rules?\.md|conventions?\.md|contributing\.md|agents\.md|plan\.md)$/i;
const VERIFY_FILE = /(^|\/)(tools\/)?verify[-_.]?/i;

export const BIOGRAPHY_RULES: BiographyRule[] = [
  {
    id: "prototype_origin",
    section: "former-identity",
    scan: ({ signals }) => {
      const hits = [...matchingLines(signals.readme, PROTOTYPE), ...matchingLines(signals.const, PROTOTYPE)];
      if (!hits.length) return null;
      return {
        kind: "backed",
        text: "Es begann als etwas Kleineres: die eigene Dokumentation nennt einen Prototyp, eine Portierung oder eine Single-File-Fassung als Ausgangspunkt.",
        evidence: hits.slice(0, 3).map((l) => ({ k: "Dokumentation", v: excerpt(l) })),
      };
    },
  },
  {
    id: "renamed_identity",
    section: "former-identity",
    scan: ({ signals }) => {
      const hits = [...matchingLines(signals.readme, RENAMED), ...matchingLines(signals.const, RENAMED)];
      if (!hits.length) return null;
      return {
        kind: "backed",
        text: "Das Repository trug erkennbar schon einmal einen anderen Namen oder eine andere Rolle — es sagt es selbst.",
        evidence: hits.slice(0, 3).map((l) => ({ k: "Dokumentation", v: excerpt(l) })),
      };
    },
  },
  {
    id: "narrow_start",
    section: "former-identity",
    scan: ({ signals }) => {
      const topLevel = new Set(
        treePaths(signals)
          .map((p) => p.split("/")[0])
          .filter((p) => p && !p.includes(".")),
      );
      if (topLevel.size < 5 || !signals.readme.trim()) return null;
      return {
        kind: "hypothesis",
        text: `Der Einstieg liest sich enger als der heutige Umfang: ein Zweck in der Beschreibung, ${topLevel.size} Bereiche im Baum.`,
        evidence: [{ k: "Baum", v: `${topLevel.size} Verzeichnisse auf oberster Ebene` }],
        basis: "Aus dem Verhältnis von Beschreibung zu Umfang geschlossen — die Dateihistorie wurde nicht gelesen.",
      };
    },
  },
  {
    id: "governance_apparatus",
    section: "actual-outcome",
    scan: ({ signals }) => {
      const files = treePaths(signals).filter((p) => GOVERNANCE_FILE.test(p.split("/").pop() ?? ""));
      const normative = matchingLines(signals.commits, NORMATIVE);
      if (files.length + normative.length < 2) return null;
      const evidence: Evidence[] = [];
      if (files.length) evidence.push({ k: "Baum", v: `${files.length} Regel-Dateien: ${files.join(", ")}` });
      if (normative.length) {
        evidence.push({ k: "Commits", v: `${normative.length} Nachrichten in Grundsatz-Sprache` });
        normative.slice(0, 2).forEach((l) => evidence.push({ k: "Commit", v: excerpt(l) }));
      }
      return {
        kind: "backed",
        text: `Daraus wurde eine Ordnung: ${files.length} Regel-Datei${files.length === 1 ? "" : "en"} und ${normative.length} Commit-Nachricht${normative.length === 1 ? "" : "en"}, die keine Änderung beschreiben, sondern eine Vorschrift.`,
        evidence,
      };
    },
  },
  {
    id: "verification_apparatus",
    section: "actual-outcome",
    scan: ({ signals }) => {
      const files = treePaths(signals).filter((p) => VERIFY_FILE.test(p));
      if (files.length < 2) return null;
      return {
        kind: "backed",
        text: `Ein eigener Prüfapparat ist entstanden: ${files.length} Dateien beschäftigen sich damit, dem eigenen Zustand nicht zu glauben.`,
        evidence: [{ k: "Baum", v: files.slice(0, 5).join(", ") }],
      };
    },
  },
  {
    id: "rules_outgrew_runtime",
    section: "actual-outcome",
    scan: ({ atoms }) => {
      const governing = atoms.filter((a) => a.cat === "authority" || a.cat === "adjudication").length;
      const rest = atoms.length - governing;
      if (atoms.length < 4 || governing <= rest) return null;
      return {
        kind: "backed",
        text: `Die Verwaltung hat die Sache überholt: ${governing} von ${atoms.length} Befunden betreffen Zuständigkeit und Rechtsprechung, nur ${rest} das eigentliche Verhalten.`,
        evidence: [{ k: "Befunde", v: `${governing} regelnd, ${rest} beschreibend` }],
      };
    },
  },
  {
    id: "agentic_development_model",
    section: "actual-outcome",
    scan: ({ atoms }) => {
      const multiAgent = atoms.find((a) => a.id === "multi_agent_workflow");
      const roleAsymmetry = atoms.find((a) => a.id === "contributor_role_asymmetry");
      const provenance = atoms.find((a) => a.id === "implementation_provenance");

      if (!multiAgent || !roleAsymmetry) return null;

      const evidence: Evidence[] = [
        { k: "Pattern", v: "Multi-Agenten-Orchestrierung mit zentraler Kontrollinstanz" },
        ...(multiAgent.evidence || []).slice(0, 2),
        ...(roleAsymmetry.evidence || []).slice(0, 2),
        ...(provenance?.evidence || []).slice(0, 1),
      ];

      return {
        kind: "backed",
        text: "Dieses Repository entstand nicht durch klassische individuelle Programmierung. Es folgt einem Modell agentischer Produktentwicklung: Der Nutzer spezifiziert Architektur, orchestriert wechselnde Coding-Agenten und prüft Integration; Implementierung erfolgt durch systematisch rotierende KI-Agenten.",
        evidence,
      };
    },
  },
];

export function deriveBiography(ctx: BiographyContext): BiographyFinding[] {
  const findings: BiographyFinding[] = [];
  for (const rule of BIOGRAPHY_RULES) {
    const match = rule.scan(ctx);
    if (!match) continue;
    findings.push({ id: rule.id, section: rule.section, ...match });
  }
  return findings;
}
