// plan §17 — In-memory AlfretStore for tests. Implements close() for interface parity.

import type { AlfretStore, Entity } from "./types";

export class MemoryStore implements AlfretStore {
  private map = new Map<string, Entity>();

  /** No-op for memory stores; exists so factory.ts can call closeStore() uniformly. */
  close(): void {}

  async put(entity: Entity): Promise<void> {
    this.map.set(`${entity.kind}::${entity.id}`, entity);
  }

  async get<T extends Entity>(kind: T["kind"], id: string): Promise<T | undefined> {
    return this.map.get(`${kind}::${id}`) as T | undefined;
  }

  async list<T extends Entity>(kind: T["kind"]): Promise<T[]> {
    const results: T[] = [];
    for (const [key, val] of this.map) {
      if (key.startsWith(`${kind}::`)) results.push(val as T);
    }
    return results;
  }

  async delete(kind: string, id: string): Promise<void> {
    this.map.delete(`${kind}::${id}`);
  }
}
