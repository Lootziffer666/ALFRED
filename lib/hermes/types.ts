/**
 * Hermes — Typen (Etappe 10a).
 *
 * Hermes orchestriert Agents, Module, Runner und externe Dienste.
 * Er führt ALFRETs autorisierte Pläne aus. Er entscheidet nicht über
 * Produktstrategie oder kanonische Architektur — das ist der Supervisor.
 *
 * Jeder Auftrag stammt aus einem vom Supervisor signierten Plan.
 * Hermes darf keinen Auftrag ohne gültigen signierten Plan starten.
 */

import type { SignedExecutionPlan } from "../../lib/schema/homelab";

// ── Auftragszustände ────────────────────────────────────────────────────────

export type OrderState =
  | "pending"       // Auftrag eingegangen, noch nicht gestartet
  | "dispatched"    // An Runner oder Agent übergeben
  | "running"       // Läuft
  | "paused"        // Bewusst pausiert (z.B. Ressourcenmangel)
  | "completed"     // Erfolgreich abgeschlossen
  | "failed"        // Fehlgeschlagen, kein Retry mehr
  | "cancelled"     // Explizit abgebrochen
  | "superseded";   // Durch neueren Auftrag ersetzt

// ── Session ────────────────────────────────────────────────────────────────

export type SessionPhase =
  | "initializing"
  | "planning"
  | "executing"
  | "verifying"
  | "handoff"
  | "idle"
  | "terminated";

export interface HermesSession {
  sessionId: string;
  agentId: string;
  taskId: string;
  /** Der Plan der diese Session autorisiert hat. */
  planId: string;
  nodeId: string;
  phase: SessionPhase;
  /** SHA des aktuellen Worktree-Heads — null vor dem ersten Commit. */
  headSha: string | null;
  worktree: string | null;
  /** Lease-Ablaufzeit ISO-8601. Null = kein Ablauf. */
  leaseExpiresAt: string | null;
  startedAt: string;
  updatedAt: string;
  terminatedAt: string | null;
}

// ── Auftrag ────────────────────────────────────────────────────────────────

export interface HermesOrder {
  orderId: string;
  planId: string;
  /** Kopie des signierten Plans — Hermes führt nichts ohne Signatur aus. */
  plan: SignedExecutionPlan;
  state: OrderState;
  sessionId: string | null;
  /** Wie oft wurde dieser Auftrag bereits versucht. */
  attempts: number;
  /** Maximale Anzahl automatischer Retries (0 = kein Retry). */
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  failureReason: string | null;
}

// ── Handoff ────────────────────────────────────────────────────────────────

/**
 * Ein Handoff-Paket wird erzeugt wenn ein Agent stirbt, stalled oder
 * ausgetauscht wird. Der nachfolgende Agent startet damit — nicht blind.
 */
export interface HandoffPackage {
  handoffId: string;
  fromAgentId: string;
  toAgentId: string | null;    // Null = noch kein Nachfolger bestimmt
  taskId: string;
  planId: string;
  /** Letzter bekannter stabiler HEAD. */
  lastStableHeadSha: string | null;
  /** Checkpoint-Beschreibung für den Nachfolger. */
  checkpointSummary: string;
  /** Offene Teilaufgaben. */
  remainingSteps: string[];
  /** Was bereits getan wurde und nachweislich korrekt ist. */
  completedSteps: string[];
  blockers: string[];
  createdAt: string;
}

// ── Events ─────────────────────────────────────────────────────────────────

export type HermesEventKind =
  | "order-created"
  | "order-dispatched"
  | "order-completed"
  | "order-failed"
  | "order-cancelled"
  | "session-started"
  | "session-phase-changed"
  | "session-terminated"
  | "handoff-created"
  | "handoff-accepted"
  | "runner-event-forwarded"
  | "supervisor-notified";

export interface HermesEvent {
  eventId: string;
  kind: HermesEventKind;
  orderId: string;
  sessionId: string | null;
  payload: Record<string, unknown>;
  timestamp: string;
}

// ── Dispatcher-Interface ───────────────────────────────────────────────────

/**
 * Was Hermes nach außen bietet. Die UI und der Supervisor sprechen
 * ausschließlich gegen dieses Interface — nie gegen eine Implementierung.
 */
export interface HermesDispatcher {
  /** Nimmt einen signierten Plan entgegen und erzeugt einen Auftrag. */
  submit(plan: SignedExecutionPlan): Promise<HermesOrder>;

  /** Gibt den aktuellen Zustand eines Auftrags zurück. */
  getOrder(orderId: string): Promise<HermesOrder | null>;

  /** Gibt alle aktiven Sessions zurück. */
  listSessions(): Promise<HermesSession[]>;

  /** Bricht einen laufenden Auftrag ab. */
  cancel(orderId: string, reason: string): Promise<void>;

  /** Erzeugt ein Handoff-Paket für einen sterbenden Agenten. */
  createHandoff(sessionId: string, summary: string, remaining: string[], completed: string[], blockers: string[]): Promise<HandoffPackage>;

  /** Event-Stream für einen Auftrag. */
  streamEvents(orderId: string): AsyncIterable<HermesEvent>;
}
