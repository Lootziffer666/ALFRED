/**
 * SQLite Persistenzbasis (Etappe 11a).
 * Für Produktion — mit Bun:sqlite.
 */

import { Database } from "bun:sqlite";
import type { HermesOrder, HermesSession, HermesEvent, HandoffPackage } from "@/lib/hermes/types";
import type { CueReport } from "@/lib/cue/types";
import type { MaidReport } from "@/lib/maid/types";
import type { Heartbeat } from "@/lib/health/types";
import type { AlfretStore } from "./types";

export class SqliteAlfretStore implements AlfretStore {
  private db: Database;

  constructor(dbPath: string = ":memory:") {
    this.db = new Database(dbPath);
    this.initializeTables();
  }

  private initializeTables(): void {
    // Entity Store — für Entities mit ID als Primary Key
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entity_store (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        data TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    // Event Store — append-only
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS event_store (
        eventId TEXT PRIMARY KEY,
        orderId TEXT NOT NULL,
        kind TEXT NOT NULL,
        data TEXT NOT NULL,
        timestamp TEXT NOT NULL
      )
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_event_orderId ON event_store(orderId)
    `);

    // Heartbeat Store — append-only time-series
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS heartbeat_store (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agentId TEXT NOT NULL,
        taskId TEXT NOT NULL,
        sessionId TEXT NOT NULL,
        data TEXT NOT NULL,
        timestamp TEXT NOT NULL
      )
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_heartbeat_agent ON heartbeat_store(agentId)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_heartbeat_task ON heartbeat_store(taskId)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_heartbeat_agent_task ON heartbeat_store(agentId, taskId)
    `);
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private parseEntity<T>(data: string): T {
    return JSON.parse(data) as T;
  }

  private stringifyEntity<T>(entity: T): string {
    return JSON.stringify(entity);
  }

  private storeEntity(id: string, kind: string, entity: unknown): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO entity_store (id, kind, data, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, kind, this.stringifyEntity(entity), now, now);
  }

  private getEntity<T>(id: string, kind: string): T | null {
    const stmt = this.db.prepare(`
      SELECT data FROM entity_store WHERE id = ? AND kind = ?
    `);
    const row = stmt.get(id, kind) as { data: string } | undefined;
    return row ? this.parseEntity<T>(row.data) : null;
  }

  // ── Orders ───────────────────────────────────────────────────────────────

  async setOrder(order: HermesOrder): Promise<void> {
    this.storeEntity(order.orderId, "order", order);
  }

  async getOrder(orderId: string): Promise<HermesOrder | null> {
    return this.getEntity<HermesOrder>(orderId, "order");
  }

  async listOrders(state?: string): Promise<HermesOrder[]> {
    const stmt = this.db.prepare(`
      SELECT data FROM entity_store WHERE kind = 'order'
    `);
    const rows = stmt.all() as { data: string }[];
    const orders = rows.map((r) => this.parseEntity<HermesOrder>(r.data));
    return state ? orders.filter((o) => o.state === state) : orders;
  }

  // ── Sessions ─────────────────────────────────────────────────────────────

  async setSession(session: HermesSession): Promise<void> {
    this.storeEntity(session.sessionId, "session", session);
  }

  async getSession(sessionId: string): Promise<HermesSession | null> {
    return this.getEntity<HermesSession>(sessionId, "session");
  }

  async listSessions(): Promise<HermesSession[]> {
    const stmt = this.db.prepare(`
      SELECT data FROM entity_store WHERE kind = 'session'
    `);
    const rows = stmt.all() as { data: string }[];
    return rows.map((r) => this.parseEntity<HermesSession>(r.data));
  }

  // ── Events (append-only) ────────────────────────────────────────────────

  async appendEvent(event: HermesEvent): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO event_store (eventId, orderId, kind, data, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      event.eventId,
      event.orderId,
      event.kind,
      this.stringifyEntity(event),
      event.timestamp,
    );
  }

  async getEvents(orderId: string): Promise<HermesEvent[]> {
    const stmt = this.db.prepare(`
      SELECT data FROM event_store WHERE orderId = ? ORDER BY timestamp ASC
    `);
    const rows = stmt.all(orderId) as { data: string }[];
    return rows.map((r) => this.parseEntity<HermesEvent>(r.data));
  }

  async allEvents(): Promise<HermesEvent[]> {
    const stmt = this.db.prepare(`
      SELECT data FROM event_store ORDER BY timestamp ASC
    `);
    const rows = stmt.all() as { data: string }[];
    return rows.map((r) => this.parseEntity<HermesEvent>(r.data));
  }

  // ── Handoffs ────────────────────────────────────────────────────────────

  async setHandoff(handoff: HandoffPackage): Promise<void> {
    this.storeEntity(handoff.handoffId, "handoff", handoff);
  }

  async getHandoff(handoffId: string): Promise<HandoffPackage | null> {
    return this.getEntity<HandoffPackage>(handoffId, "handoff");
  }

  async listHandoffs(taskId: string): Promise<HandoffPackage[]> {
    const stmt = this.db.prepare(`
      SELECT data FROM entity_store WHERE kind = 'handoff'
    `);
    const rows = stmt.all() as { data: string }[];
    const handoffs = rows.map((r) => this.parseEntity<HandoffPackage>(r.data));
    return handoffs.filter((h) => h.taskId === taskId);
  }

  // ── Heartbeats ──────────────────────────────────────────────────────────

  async appendHeartbeat(heartbeat: Heartbeat): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO heartbeat_store (agentId, taskId, sessionId, data, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(
      heartbeat.agentId,
      heartbeat.taskId,
      heartbeat.sessionId,
      this.stringifyEntity(heartbeat),
      heartbeat.timestamp,
    );
  }

  async getHeartbeats(agentId: string): Promise<Heartbeat[]> {
    const stmt = this.db.prepare(`
      SELECT data FROM heartbeat_store WHERE agentId = ? ORDER BY timestamp ASC
    `);
    const rows = stmt.all(agentId) as { data: string }[];
    return rows.map((r) => this.parseEntity<Heartbeat>(r.data));
  }

  async getLatestHeartbeat(agentId: string, taskId: string): Promise<Heartbeat | null> {
    const stmt = this.db.prepare(`
      SELECT data FROM heartbeat_store
      WHERE agentId = ? AND taskId = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `);
    const row = stmt.get(agentId, taskId) as { data: string } | undefined;
    return row ? this.parseEntity<Heartbeat>(row.data) : null;
  }

  // ── CUE Reports ─────────────────────────────────────────────────────────

  async setCueReport(report: CueReport): Promise<void> {
    this.storeEntity(report.reportId, "cue-report", report);
  }

  async getCueReport(reportId: string): Promise<CueReport | null> {
    return this.getEntity<CueReport>(reportId, "cue-report");
  }

  async listCueReports(planId: string): Promise<CueReport[]> {
    const stmt = this.db.prepare(`
      SELECT data FROM entity_store WHERE kind = 'cue-report'
    `);
    const rows = stmt.all() as { data: string }[];
    const reports = rows.map((r) => this.parseEntity<CueReport>(r.data));
    return reports.filter((r) => r.planId === planId);
  }

  // ── Maid Reports ────────────────────────────────────────────────────────

  async setMaidReport(report: MaidReport): Promise<void> {
    this.storeEntity(report.commitSha, "maid-report", report);
  }

  async getMaidReport(commitSha: string): Promise<MaidReport | null> {
    return this.getEntity<MaidReport>(commitSha, "maid-report");
  }

  async allMaidReports(): Promise<MaidReport[]> {
    const stmt = this.db.prepare(`
      SELECT data FROM entity_store WHERE kind = 'maid-report'
    `);
    const rows = stmt.all() as { data: string }[];
    return rows.map((r) => this.parseEntity<MaidReport>(r.data));
  }

  close(): void {
    this.db.close();
  }
}
