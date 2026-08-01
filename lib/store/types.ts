/**
 * Persistanzschicht (Etappe 11a).
 *
 * AlfretStore ist die zentrale Persistenzbasis für alle ALFRET-Betriebsdaten:
 * Orders, Sessions, Events, Handoffs, Heartbeats, CueReports, MaidReports.
 *
 * Zwei Implementierungen: MemoryAlfretStore (Tests/Demo) und SqliteAlfretStore (Produktion).
 */

import type { HermesOrder, HermesSession, HermesEvent, HandoffPackage } from "@/lib/hermes/types";
import type { CueReport } from "@/lib/cue/types";
import type { MaidReport } from "@/lib/maid/types";
import type { Heartbeat } from "@/lib/health/types";

/**
 * Persistenzbasis für ALFRET.
 * Alle Methoden sind async zur Vorbereitung auf SQLite (bald auch verteilte Persistenz).
 */
export interface AlfretStore {
  // ── Orders ──────────────────────────────────────────────────────────────
  setOrder(order: HermesOrder): Promise<void>;
  getOrder(orderId: string): Promise<HermesOrder | null>;
  listOrders(state?: string): Promise<HermesOrder[]>;

  // ── Sessions ────────────────────────────────────────────────────────────
  setSession(session: HermesSession): Promise<void>;
  getSession(sessionId: string): Promise<HermesSession | null>;
  listSessions(): Promise<HermesSession[]>;

  // ── Events (append-only) ────────────────────────────────────────────────
  appendEvent(event: HermesEvent): Promise<void>;
  getEvents(orderId: string): Promise<HermesEvent[]>;
  allEvents(): Promise<HermesEvent[]>;

  // ── Handoffs ────────────────────────────────────────────────────────────
  setHandoff(handoff: HandoffPackage): Promise<void>;
  getHandoff(handoffId: string): Promise<HandoffPackage | null>;
  listHandoffs(taskId: string): Promise<HandoffPackage[]>;

  // ── Heartbeats ──────────────────────────────────────────────────────────
  appendHeartbeat(heartbeat: Heartbeat): Promise<void>;
  getHeartbeats(agentId: string): Promise<Heartbeat[]>;
  getLatestHeartbeat(agentId: string, taskId: string): Promise<Heartbeat | null>;

  // ── CUE Reports ─────────────────────────────────────────────────────────
  setCueReport(report: CueReport): Promise<void>;
  getCueReport(reportId: string): Promise<CueReport | null>;
  listCueReports(planId: string): Promise<CueReport[]>;

  // ── Maid Reports ────────────────────────────────────────────────────────
  setMaidReport(report: MaidReport): Promise<void>;
  getMaidReport(commitSha: string): Promise<MaidReport | null>;
  allMaidReports(): Promise<MaidReport[]>;
}
