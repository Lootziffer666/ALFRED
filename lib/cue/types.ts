/**
 * CUE-Agent-Interface (Etappe 10c).
 *
 * CUE erzeugt fachliche und technische Qualitätsnachweise.
 * Er arbeitet nach jeder Ausführung — nicht vorher.
 * Er verändert keine TruthStatus-Werte und keine Evidence selbst;
 * er liefert einen strukturierten Befund, den der Supervisor auswertet.
 */

export type CueVerdict =
  | "passed"
  | "partially-passed"
  | "failed"
  | "not-applicable"
  | "not-proven";

export type CueCheckKind =
  | "schema-fidelity"      // Stimmt das Ausgabeformat mit dem Vertrag überein?
  | "scope-fidelity"       // Hat der Agent außerhalb des Scope geschrieben?
  | "acceptance-criteria"  // Sind die Abnahmekriterien der Aufgabe erfüllt?
  | "regression"           // Wurden bestehende Tests nicht gebrochen?
  | "artifact-integrity"   // Stimmen Artifact-Hashes?
  | "no-placeholders"      // Keine nicht implementierten Platzhalter?
  | "doc-coverage";        // Ist die Dokumentation vollständig aktualisiert?

export interface CueCheckResult {
  kind: CueCheckKind;
  verdict: CueVerdict;
  /** Kurze Begründung — keine Modellprosa, nur strukturierte Fakten. */
  reason: string;
  /** Pfade oder Symbole, die diesen Befund belegen. */
  evidence: string[];
  checkedAt: string;
}

export interface CueReport {
  reportId: string;
  taskId: string;
  planId: string;
  /** Gesamtverdikt — schlechtestes Einzelergebnis bestimmt das Gesamte. */
  overall: CueVerdict;
  checks: CueCheckResult[];
  /** Fehlgeschlagene Checks blockieren den Merge. */
  blocksRelease: boolean;
  createdAt: string;
}

/** Was CUE nach außen bietet. */
export interface CueAgent {
  /** Prüft einen abgeschlossenen Auftrag und gibt einen Bericht zurück. */
  verify(taskId: string, planId: string, checks: CueCheckKind[]): Promise<CueReport>;
}
