/**
 * In-Memory Persistenzbasis (Etappe 11a).
 * Für Tests und Demo — Daten gehen beim Neustart verloren.
 */

import type { HermesOrder, HermesSession, HermesEvent, HandoffPackage } from "@/lib/hermes/types";
import type { CueReport } from "@/lib/cue/types";
import type { MaidReport } from "@/lib/maid/types";
import type { Heartbeat } from "@/lib/health/types";
import type { AlfretStore } from "./types";

export class MemoryAlfretStore implements AlfretStore {
  private orders = new Map<string, HermesOrder>();
  private sessions = new Map<string, HermesSession>();
  private events: HermesEvent[] = [];
  private handoffs = new Map<string, HandoffPackage>();
  private heartbeats: Heartbeat[] = [];
  private cueReports = new Map<string, CueReport>();
  private maidReports = new Map<string, MaidReport>();

  async setOrder(order: HermesOrder): Promise<void> {
    this.orders.set(order.orderId, order);
  }

  async getOrder(orderId: string): Promise<HermesOrder | null> {
    return this.orders.get(orderId) ?? null;
  }

  async listOrders(state?: string): Promise<HermesOrder[]> {
    const all = Array.from(this.orders.values());
    return state ? all.filter((o) => o.state === state) : all;
  }

  async setSession(session: HermesSession): Promise<void> {
    this.sessions.set(session.sessionId, session);
  }

  async getSession(sessionId: string): Promise<HermesSession | null> {
    return this.sessions.get(sessionId) ?? null;
  }

  async listSessions(): Promise<HermesSession[]> {
    return Array.from(this.sessions.values());
  }

  async appendEvent(event: HermesEvent): Promise<void> {
    this.events.push(event);
  }

  async getEvents(orderId: string): Promise<HermesEvent[]> {
    return this.events.filter((e) => e.orderId === orderId);
  }

  async allEvents(): Promise<HermesEvent[]> {
    return [...this.events];
  }

  async setHandoff(handoff: HandoffPackage): Promise<void> {
    this.handoffs.set(handoff.handoffId, handoff);
  }

  async getHandoff(handoffId: string): Promise<HandoffPackage | null> {
    return this.handoffs.get(handoffId) ?? null;
  }

  async listHandoffs(taskId: string): Promise<HandoffPackage[]> {
    return Array.from(this.handoffs.values()).filter((h) => h.taskId === taskId);
  }

  async appendHeartbeat(heartbeat: Heartbeat): Promise<void> {
    this.heartbeats.push(heartbeat);
  }

  async getHeartbeats(agentId: string): Promise<Heartbeat[]> {
    return this.heartbeats.filter((h) => h.agentId === agentId);
  }

  async getLatestHeartbeat(agentId: string, taskId: string): Promise<Heartbeat | null> {
    const matching = this.heartbeats.filter((h) => h.agentId === agentId && h.taskId === taskId);
    if (matching.length === 0) return null;
    return matching[matching.length - 1];
  }

  async setCueReport(report: CueReport): Promise<void> {
    this.cueReports.set(report.reportId, report);
  }

  async getCueReport(reportId: string): Promise<CueReport | null> {
    return this.cueReports.get(reportId) ?? null;
  }

  async listCueReports(planId: string): Promise<CueReport[]> {
    return Array.from(this.cueReports.values()).filter((r) => r.planId === planId);
  }

  async setMaidReport(report: MaidReport): Promise<void> {
    this.maidReports.set(report.commitSha, report);
  }

  async getMaidReport(commitSha: string): Promise<MaidReport | null> {
    return this.maidReports.get(commitSha) ?? null;
  }

  async allMaidReports(): Promise<MaidReport[]> {
    return Array.from(this.maidReports.values());
  }
}
