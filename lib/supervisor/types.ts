/**
 * Supervisor-Interface (Etappe 10b).
 *
 * Der Supervisor versteht Projektziele und den aktuellen Zustand,
 * ermittelt den nächsten sinnvollen Schritt und autorisiert Arbeit
 * für Hermes. Er akzeptiert unbekannte Zustände und rät nicht bei
 * fehlender Evidence.
 *
 * Der Supervisor ist kein Executor — er plant, er führt nicht aus.
 */

import type { SignedExecutionPlan } from "../../lib/schema/homelab";
import type { HermesOrder } from "../hermes";

// ── Supervisor-Entscheidung ────────────────────────────────────────────────

export type SupervisorDecision =
  | "authorize"       // Plan autorisieren und an Hermes übergeben
  | "defer"           // Noch nicht starten — Bedingungen nicht erfüllt
  | "shrink"          // Aufgabe verkleinern und neu planen
  | "escalate"        // Mensch muss entscheiden
  | "abandon";        // Aufgabe aufgeben

export interface SupervisorVerdict {
  decision: SupervisorDecision;
  reason: string;
  /** Nur gesetzt wenn decision === "authorize". */
  plan: SignedExecutionPlan | null;
  /** Nur gesetzt wenn decision === "escalate" oder "abandon". */
  blockers: string[];
  decidedAt: string;
}

// ── Planschleife ───────────────────────────────────────────────────────────

export type LoopPhase =
  | "assess"      // Zustand bewerten
  | "plan"        // Nächsten Schritt ermitteln
  | "authorize"   // Plan signieren und an Hermes übergeben
  | "observe"     // Auf Ergebnis warten
  | "verify"      // CUE-Prüfung
  | "update"      // Repo Maid und Korpus aktualisieren
  | "idle";       // Kein sinnvoller nächster Schritt

export interface LoopState {
  phase: LoopPhase;
  iteration: number;
  lastVerdict: SupervisorVerdict | null;
  lastOrder: HermesOrder | null;
  /** Aktuell blockierende Bedingungen. Leer = kein Blocker. */
  blockers: string[];
  updatedAt: string;
}

// ── Supervisor-Interface ───────────────────────────────────────────────────

export interface Supervisor {
  /**
   * Bewertet den aktuellen Zustand und gibt ein Urteil zurück.
   * Wenn nicht genug Evidence vorhanden ist, gibt er "defer" oder
   * "escalate" zurück — er erfindet keine Antworten.
   */
  assess(context: SupervisorContext): SupervisorVerdict;

  /** Autorisiert einen Plan und gibt ihn an Hermes weiter. */
  authorize(plan: SignedExecutionPlan): Promise<HermesOrder>;

  /** Gibt den aktuellen Loop-Zustand zurück. */
  loopState(): LoopState;
}

export interface SupervisorContext {
  /** Was soll erreicht werden. */
  objective: string;
  /** Aktuell bekannte Blocker (aus Health-Checks, Refinery, Maid). */
  blockers: string[];
  /** Ist genug Evidence da um zu entscheiden? */
  evidenceSufficient: boolean;
  /** Hat der letzte Auftrag erfolgreich abgeschlossen? */
  lastOrderSucceeded: boolean | null;
  /** Iteration — verhindert Endlosschleifen. */
  iteration: number;
}
