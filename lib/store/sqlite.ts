// plan §17 — SQLite-backed AlfretStore.
//
// Two runtimes open this store: the daemon (bun run daemon, or the
// --target=node bundle) and the Next.js server. They do not share a SQLite
// binding — Bun ships `bun:sqlite`, Node ships `node:sqlite`, and neither
// runtime can load the other's module. So the driver is picked at open time
// and hidden behind the small surface this store actually uses.
//
// The specifier is computed, and both bundlers are told to leave the import
// alone: a static `import "bun:sqlite"` made `next build` fail while
// collecting page data, because the Next server is Node and has no such
// module.

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { AlfretStore, Entity } from "./types";

/** The intersection of bun:sqlite and node:sqlite this store relies on. */
interface Stmt<Row> {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): Row | undefined;
  all(...params: unknown[]): Row[];
}

interface Db {
  exec(sql: string): void;
  close(): void;
  prepare<Row = Record<string, unknown>>(sql: string): Stmt<Row>;
}

interface BunDatabase {
  exec(sql: string): void;
  close(): void;
  query<Row>(sql: string): Stmt<Row>;
}

function isBun(): boolean {
  return typeof (globalThis as { Bun?: unknown }).Bun !== "undefined";
}

async function openDatabase(path: string): Promise<Db> {
  if (isBun()) {
    const specifier = "bun:sqlite";
    const { Database } = (await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ specifier
    )) as { Database: new (p: string, o?: { create?: boolean }) => BunDatabase };
    const db = new Database(path, { create: true });
    return {
      exec: (sql) => db.exec(sql),
      close: () => db.close(),
      prepare: <Row>(sql: string) => db.query<Row>(sql),
    };
  }

  const specifier = "node:sqlite";
  const { DatabaseSync } = (await import(
    /* webpackIgnore: true */ /* turbopackIgnore: true */ specifier
  )) as { DatabaseSync: new (p: string) => Db };
  const db = new DatabaseSync(path);
  return {
    exec: (sql) => db.exec(sql),
    close: () => db.close(),
    prepare: <Row>(sql: string) => db.prepare<Row>(sql),
  };
}

export class SqliteStore implements AlfretStore {
  private constructor(private db: Db) {}

  /**
   * Opens the store. Async because the driver is resolved at runtime — use
   * openStore() from ./factory rather than calling this directly.
   */
  static async open(path: string): Promise<SqliteStore> {
    // Neither driver creates the parent directory, and the default path lives
    // in ~/.alfret — on a fresh machine that is "unable to open database file".
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    const db = await openDatabase(path);
    // WAL: Daemon schreibt, Next.js liest gleichzeitig — kein SQLITE_BUSY.
    db.exec("PRAGMA journal_mode=WAL");
    db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        kind TEXT NOT NULL,
        id   TEXT NOT NULL,
        data TEXT NOT NULL,
        PRIMARY KEY (kind, id)
      )
    `);
    return new SqliteStore(db);
  }

  /** plan §17 — Daemon must call this before SIGTERM exits to release the file handle. */
  close(): void {
    this.db.close();
  }

  async put(entity: Entity): Promise<void> {
    this.db
      .prepare("INSERT OR REPLACE INTO entities (kind, id, data) VALUES (?, ?, ?)")
      .run(entity.kind, entity.id, JSON.stringify(entity));
  }

  async get<T extends Entity>(kind: T["kind"], id: string): Promise<T | undefined> {
    const row = this.db
      .prepare<{ data: string }>("SELECT data FROM entities WHERE kind = ? AND id = ?")
      .get(kind, id);
    return row ? (JSON.parse(row.data) as T) : undefined;
  }

  async list<T extends Entity>(kind: T["kind"]): Promise<T[]> {
    return this.db
      .prepare<{ data: string }>("SELECT data FROM entities WHERE kind = ?")
      .all(kind)
      .map((r) => JSON.parse(r.data) as T);
  }

  async delete(kind: string, id: string): Promise<void> {
    this.db.prepare("DELETE FROM entities WHERE kind = ? AND id = ?").run(kind, id);
  }
}
