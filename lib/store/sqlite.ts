// plan §17 — SQLite-backed AlfretStore.
// bun:sqlite is declared in types/bun.d.ts (ambient, no bun-types to avoid DOM/node collisions).

import { Database } from "bun:sqlite";
import type { AlfretStore, Entity } from "./types.js";

export class SqliteStore implements AlfretStore {
  private db: Database;

  constructor(path: string) {
    this.db = new Database(path, { create: true });
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        kind TEXT NOT NULL,
        id   TEXT NOT NULL,
        data TEXT NOT NULL,
        PRIMARY KEY (kind, id)
      )
    `);
  }

  /** plan §17 — Daemon must call this before SIGTERM exits to release the file handle. */
  close(): void {
    this.db.close();
  }

  async put(entity: Entity): Promise<void> {
    this.db
      .query("INSERT OR REPLACE INTO entities (kind, id, data) VALUES (?, ?, ?)")
      .run(entity.kind, entity.id, JSON.stringify(entity));
  }

  async get<T extends Entity>(kind: T["kind"], id: string): Promise<T | undefined> {
    const row = this.db
      .query<{ data: string }>("SELECT data FROM entities WHERE kind = ? AND id = ?")
      .get(kind, id);
    return row ? (JSON.parse(row.data) as T) : undefined;
  }

  async list<T extends Entity>(kind: T["kind"]): Promise<T[]> {
    return this.db
      .query<{ data: string }>("SELECT data FROM entities WHERE kind = ?")
      .all(kind)
      .map((r) => JSON.parse(r.data) as T);
  }

  async delete(kind: string, id: string): Promise<void> {
    this.db.query("DELETE FROM entities WHERE kind = ? AND id = ?").run(kind, id);
  }
}
