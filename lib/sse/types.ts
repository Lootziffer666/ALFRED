/**
 * Server-Sent Events — Typen (Etappe 13a).
 *
 * SSE ist der richtige Kanal für Raum IX: unidirektional
 * (Server → Browser), kein WebSocket-Overhead, native
 * Browser-Unterstützung, automatisches Reconnect.
 *
 * Jedes Event trägt einen Typ, eine optionale ID (für
 * Last-Event-ID / Reconnect-Resume) und eine typsichere
 * Payload. Der Client kann nach Verbindungsabbruch mit dem
 * letzten Event-ID-Wert reconnecten und bekommt nur neue Events.
 */

// ── Event-Typen ────────────────────────────────────────────────────────────

export type SseEventKind =
  | "order-update"       // HermesOrder hat Zustandswechsel
  | "session-update"     // HermesSession hat Phase gewechselt
  | "heartbeat"          // Neuer Heartbeat von einem Agent
  | "cue-report"         // Neuer CUE-Bericht verfügbar
  | "maid-report"        // Neuer Maid-Report verfügbar
  | "supervisor-tick"    // Supervisor-Loop hat eine Runde abgeschlossen
  | "demo-result"        // Demo-Ausführung abgeschlossen
  | "ping";              // Keep-alive (alle 15s)

export interface SseEvent<T = unknown> {
  /** Eindeutige monoton steigende ID. Für Last-Event-ID-Resume. */
  id: string;

  kind: SseEventKind;

  payload: T;

  timestamp: string;
}

// ── Payload-Typen ───────────────────────────────────────────────────────────

export interface OrderUpdatePayload {
  orderId: string;
  planId: string;
  state: string;
  updatedAt: string;
  failureReason: string | null;
}

export interface SessionUpdatePayload {
  sessionId: string;
  agentId: string;
  phase: string;
  headSha: string | null;
  updatedAt: string;
}

export interface HeartbeatPayload {
  agentId: string;
  taskId: string;
  phase: string;
  status: string;
  timestamp: string;
}

export interface SupervisorTickPayload {
  tickId: string;
  phase: string;
  activeOrders: number;
  activeSessions: number;
  timestamp: string;
}

export interface PingPayload {
  serverTime: string;
}
