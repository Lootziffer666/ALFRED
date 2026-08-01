/**
 * Refinery — Typen (Etappe 9b).
 *
 * Die Refinery simuliert Merges gegen eine frische Zielbasis, klassifiziert
 * Konflikte und repariert nur was nachweislich sicher ist. Modellprosa ist
 * kein Beweis. Ein Exitcode 0 allein auch nicht.
 */

export type RefineryState =
  | "submitted"
  | "quarantined"
  | "baseline-verified"
  | "merge-simulated"
  | "conflict-classified"
  | "repaired"
  | "agent-fix"
  | "rejected"
  | "escalated"
  | "tested"
  | "acceptance-verified"
  | "queue-ready"
  | "final-rebase-check"
  | "merged"
  | "post-merge-verified";

export type ConflictClass =
  | "formatter"            // Deterministisch reparierbar
  | "import-sort"          // Deterministisch reparierbar
  | "generated-file"       // Deterministisch reparierbar
  | "lockfile"             // Deterministisch reparierbar
  | "public-api-change"    // Eskalation erforderlich
  | "architecture-change"  // Eskalation erforderlich
  | "deleted-feature"      // Eskalation erforderlich
  | "contract-change"      // Eskalation erforderlich
  | "schema-migration"     // Eskalation erforderlich
  | "removed-test"         // Blockiert Merge
  | "weakened-test"        // Blockiert Merge
  | "scope-expansion"      // Eskaliert
  | "semantic-unknown";    // Eskaliert — Mensch muss entscheiden

export type RepairVerdict =
  | "repaired"
  | "repair-failed"
  | "escalation-required"
  | "merge-blocked";

export interface ConflictRecord {
  path: string;
  class: ConflictClass;
  /** Deterministisch reparierbar ohne semantisches Risiko. */
  autoRepairable: boolean;
  detail: string;
  verdict: RepairVerdict;
}

export interface MergeSimulation {
  prId: string;
  headSha: string;
  baseSha: string;
  state: RefineryState;
  conflicts: ConflictRecord[];
  /** Alle Konflikte wurden repariert oder es gab keine. */
  clean: boolean;
  /** Post-Merge-Healthcheck ist Pflicht — kein Merge ohne diesen. */
  postMergeHealthPassed: boolean | null;
  simulatedAt: string;
  mergedAt: string | null;
  rejectionReason: string | null;
}

/** Reparaturregeln — nur deterministische Transformationen. */
export type RepairRule =
  | "apply-formatter"
  | "sort-imports"
  | "regenerate-types"
  | "regenerate-lockfile"
  | "clean-rebase";
