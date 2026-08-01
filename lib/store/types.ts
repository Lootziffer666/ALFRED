// plan §17 — AlfretStore interface. close() added so Daemon can free SQLite handle at SIGTERM.

export interface Entity {
  kind: string;
  id: string;
}

export interface AlfretStore {
  put(entity: Entity): Promise<void>;
  get<T extends Entity>(kind: T["kind"], id: string): Promise<T | undefined>;
  list<T extends Entity>(kind: T["kind"]): Promise<T[]>;
  delete(kind: string, id: string): Promise<void>;
  /** Release any held OS resources (SQLite file handle). No-op for memory stores. */
  close(): void;
}
