// Ambient declarations for bun:sqlite.
// Deliberately minimal — only what lib/store/sqlite.ts uses.
// Do NOT replace with bun-types: its globals collide with @types/node and Next's DOM lib.

declare module "bun:sqlite" {
  export class Database {
    constructor(filename: string, options?: { create?: boolean; readonly?: boolean });
    close(): void;
    exec(sql: string): void;
    query<Row = Record<string, unknown>>(sql: string): Statement<Row>;
  }

  interface Statement<Row> {
    run(...params: unknown[]): void;
    get(...params: unknown[]): Row | undefined;
    all(...params: unknown[]): Row[];
  }
}
