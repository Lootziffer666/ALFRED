/**
 * Repo Maid — Typen (Etappe 9a).
 *
 * Der Maid-Kern klassifiziert Dateien, sammelt Findings und erzeugt
 * Pflegevorschläge. Er entscheidet nicht allein — Löschen erfordert
 * immer eine explizite Freigabe (approval-required im Scope).
 */

export type FileClass =
  | "active"
  | "ignored"                  // Betreiber-Filter (maid.ignoreGlobs) hat den Pfad ausgeblendet
  | "canonical-reference"
  | "generated"
  | "temporary"
  | "duplicate"
  | "stale"
  | "archive-candidate"
  | "delete-candidate"
  | "unknown";

export type FindingSeverity = "info" | "warning" | "error";

export type FindingKind =
  | "wrong-location"           // Datei liegt nicht am kanonischen Ort
  | "stale-documentation"      // Doku beschreibt nicht mehr den Code
  | "duplicate-contract"       // Gleicher Contract an mehreren Stellen
  | "leftover-todo"            // Rest-TODO nach abgeschlossener Aufgabe
  | "placeholder-detected"     // Nicht implementierter Platzhalter
  | "temporary-output"         // Temporäres Artefakt, sollte nicht ins Repo
  | "log-limit-exceeded"       // Log-Datei überschreitet Größengrenze
  | "artifact-limit-exceeded"  // Build-Artefakt überschreitet Größengrenze
  | "old-prototype"            // Alter Prototyp, kein aktiver Code mehr
  | "acceptance-criteria-unmet"// Aufgabe fertig, aber Criteria nicht erfüllt
  | "missing-skill"            // Benötigter Skill noch nicht registriert
  | "doc-update-needed";       // Code geändert, Doku noch nicht

export interface MaidFinding {
  kind: FindingKind;
  severity: FindingSeverity;
  path: string;
  detail: string;
  /** Löschen erfordert immer approval-required im Scope. */
  suggestedClass?: FileClass;
  /** Null = kein automatischer Fix möglich. */
  autoFixable: boolean;
  observedAt: string;
}

export type MaintenancePRKind =
  | "formatter-fix"
  | "import-sort"
  | "generated-regen"
  | "lockfile-regen"
  | "stale-doc-update";

export interface MaintenancePRProposal {
  kind: MaintenancePRKind;
  title: string;
  body: string;
  /** Pfade, die der PR anfassen würde. */
  paths: string[];
  /** Alle Änderungen sind deterministisch — kein semantisches Risiko. */
  deterministic: true;
  createdAt: string;
}

export interface MaidReport {
  repository: string;
  commitSha: string;
  findings: MaidFinding[];
  proposals: MaintenancePRProposal[];
  classifiedFiles: Record<string, FileClass>;
  runAt: string;
}
