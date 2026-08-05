// plan §17 — Store-Fabrik: einheitlicher Öffnungspfad für Daemon und Tests.

import type { AlfretStore } from "./types";
import { join } from "node:path";
import { homedir } from "node:os";

export interface OpenStoreOptions {
  /** "memory" | "sqlite" — defaults to "sqlite" */
  kind?: "memory" | "sqlite";
  /** Absolute path to the SQLite file. Defaults to defaultStorePath(). */
  file?: string;
}

export function defaultStorePath(): string {
  return join(homedir(), ".alfret", "store.db");
}

/**
 * Open the configured store. The returned store must be closed with closeStore()
 * to release the SQLite handle before SIGTERM exits.
 */
export async function openStore(opts: OpenStoreOptions = {}): Promise<AlfretStore> {
  const kind = opts.kind ?? "sqlite";

  if (kind === "memory") {
    const { MemoryStore } = await import("./memory");
    return new MemoryStore();
  }

  const file = opts.file ?? defaultStorePath();
  const { SqliteStore } = await import("./sqlite");
  return SqliteStore.open(file);
}

export async function closeStore(store: AlfretStore): Promise<void> {
  if (typeof (store as { close?: () => void }).close === "function") {
    (store as { close: () => void }).close();
  }
}
