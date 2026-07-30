export interface SqlColumn {
  name: string;
  type: string;
}

export type TableRole = "repo" | "classify" | "rights" | "unknown";

export interface ColumnMap {
  name: string | null;
  readme: string | null;
  desc: string | null;
  url: string | null;
  stars: string | null;
  dom: string | null;
  role: string | null;
  prio: string | null;
  lic: string | null;
  cols: string[];
}

/** Minimal shape of a sql.js Database we rely on — see lib/sqlite/engine.ts for how it's loaded. */
export interface SqlJsDatabase {
  exec(sql: string): { columns: string[]; values: unknown[][] }[];
}

export interface SqlJsStatic {
  Database: new (data: Uint8Array) => SqlJsDatabase;
}

export interface IngestedTable {
  name: string;
  cols: SqlColumn[];
  rows: number;
  map: ColumnMap;
  role: TableRole;
  db: SqlJsDatabase;
}

export interface IngestedFile {
  fileName: string;
  db: SqlJsDatabase;
  tables: IngestedTable[];
}

export interface RepoRecord {
  id: string;
  name: string;
  stars: number;
  url: string;
  desc: string;
  hasReadme: boolean;
  classify: { domains: string[]; role: string; prio: string; fuzzy: boolean } | null;
  rights: { license: string } | null;
  _table: IngestedTable;
  _rowIndex: number;
}
