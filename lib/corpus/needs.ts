import { isOpen, staleIfMoved, type TruthStatus } from "../schema/truth";
import type {
  CapabilityClaim,
  DonorEntry,
  ExternalEntry,
  Need,
  ProjectEntry,
  Suggestion,
} from "../schema/corpus";

/**
 * The boundary between the three corpora (plan §9), enforced by signature.
 *
 * `deriveNeeds` accepts `ProjectEntry[]` and nothing else. Passing donor or
 * external entries is a type error, not a convention someone has to remember —
 * an idea from a starred repository can never become a binding requirement by
 * accident.
 */

const REASONS: Record<TruthStatus, string> = {
  declared: "Nur behauptet — die Dokumentation nennt es, der Code belegt es nicht.",
  observed: "Gefunden, aber nicht geprüft — es wurde gelesen, nicht ausgeführt.",
  verified: "Belegt und geprüft.",
  not_proven: "Nicht belegt — es gibt weder Fundstelle noch Prüflauf.",
  contradicted: "Widersprochen — Beleg und Behauptung stimmen nicht überein.",
  stale: "Veraltet — der Beleg stammt aus einem Stand, den das Repository verlassen hat.",
};

function needFrom(entry: ProjectEntry, capability: CapabilityClaim): Need {
  return {
    id: `${entry.repo.owner}/${entry.repo.name}#${capability.id}`,
    repo: entry.repo,
    capabilityId: capability.id,
    reason: REASONS[capability.truth],
    truth: capability.truth,
  };
}

/** Binding work, derived only from the project corpus. */
export function deriveNeeds(entries: ProjectEntry[]): Need[] {
  return entries.flatMap((entry) =>
    entry.capabilities.filter((c) => isOpen(c.truth)).map((c) => needFrom(entry, c)),
  );
}

/** Non-binding ideas. Donor and external material can produce nothing stronger. */
export function deriveSuggestions(entries: (DonorEntry | ExternalEntry)[]): Suggestion[] {
  return entries.flatMap((entry) =>
    entry.capabilities.map((c) => ({
      id: `${entry.corpus}:${entry.repo.owner}/${entry.repo.name}#${c.id}`,
      corpus: entry.corpus,
      repo: entry.repo,
      capabilityId: c.id,
      note:
        entry.corpus === "external"
          ? `Extern gefunden und unbestätigt: ${c.label}.`
          : `Aus dem Donor-Vorrat: ${c.label}.`,
    })),
  );
}

/**
 * Evidence read at one commit does not carry over to a later one. Anything
 * observed or verified at an older commit becomes stale; anything that was
 * never supported is left alone, because age does not improve it.
 */
export function refreshTruth<T extends { capabilities: CapabilityClaim[]; observedAtCommit?: string }>(
  entry: T,
  headCommit: string,
): T {
  return {
    ...entry,
    capabilities: entry.capabilities.map((c) => ({
      ...c,
      truth: staleIfMoved(c.truth, entry.observedAtCommit, headCommit),
    })),
  };
}
