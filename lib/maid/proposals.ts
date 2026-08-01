import type { MaintenancePRProposal } from "./types";

/**
 * Erzeugt deterministische Pflege-PR-Vorschläge.
 *
 * Nur Arten die nachweislich sicher sind: Formatter, Import-Sortierung,
 * regenerierbare Artefakte. Semantische Änderungen landen nie hier.
 */

export function formatterProposal(paths: string[]): MaintenancePRProposal {
  return {
    kind: "formatter-fix",
    title: "chore: Formatter-Korrekturen anwenden",
    body:
      "Automatisch erkannte Formatter-Abweichungen. " +
      "Alle Änderungen sind durch `bun run lint --fix` reproduzierbar. " +
      "Kein semantisches Risiko.",
    paths,
    deterministic: true,
    createdAt: new Date().toISOString(),
  };
}

export function importSortProposal(paths: string[]): MaintenancePRProposal {
  return {
    kind: "import-sort",
    title: "chore: Import-Sortierung normalisieren",
    body:
      "Import-Reihenfolge weicht vom kanonischen Stil ab. " +
      "Vollständig durch den konfigurierten Import-Sorter reproduzierbar.",
    paths,
    deterministic: true,
    createdAt: new Date().toISOString(),
  };
}

export function generatedRegenProposal(paths: string[]): MaintenancePRProposal {
  return {
    kind: "generated-regen",
    title: "chore: Generierte Dateien neu erzeugen",
    body:
      "Generierte Dateien stimmen nicht mit ihrem Quell-Artefakt überein. " +
      "Reproduzierbar durch den zugehörigen Codegen-Schritt.",
    paths,
    deterministic: true,
    createdAt: new Date().toISOString(),
  };
}

export function lockfileRegenProposal(paths: string[]): MaintenancePRProposal {
  return {
    kind: "lockfile-regen",
    title: "chore: Lockfile aktualisieren",
    body:
      "Lockfile ist nicht synchron mit package.json. " +
      "Reproduzierbar durch `bun install`.",
    paths,
    deterministic: true,
    createdAt: new Date().toISOString(),
  };
}

export function staleDocProposal(paths: string[]): MaintenancePRProposal {
  return {
    kind: "stale-doc-update",
    title: "docs: Veraltete Dokumentation kennzeichnen",
    body:
      "Dokumentationsdateien enthalten Hinweise auf nicht mehr aktuelle " +
      "Zustände oder Architekturentscheidungen. Nur Kennzeichnung — " +
      "kein inhaltliches Rewriting.",
    paths,
    deterministic: true,
    createdAt: new Date().toISOString(),
  };
}
