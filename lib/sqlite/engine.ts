import type { ColumnMap, IngestedFile, IngestedTable, RepoRecord, SqlColumn, SqlJsDatabase, SqlJsStatic, TableRole } from "./types";

declare global {
  interface Window {
    initSqlJs?: (config: { locateFile: (file: string) => string }) => Promise<SqlJsStatic>;
  }
}

let sqlPromise: Promise<SqlJsStatic> | null = null;

/** Loads sql.js from the static assets in public/sql-js (see that folder's README) — client-only, lazy, cached. */
export function loadSqlJs(): Promise<SqlJsStatic> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("sql.js can only be loaded in the browser."));
  }
  if (sqlPromise) return sqlPromise;

  sqlPromise = new Promise<SqlJsStatic>((resolve, reject) => {
    const init = () => {
      if (typeof window.initSqlJs !== "function") {
        reject(new Error("sql.js script loaded but initSqlJs is not defined."));
        return;
      }
      window
        .initSqlJs({ locateFile: (f) => `/sql-js/${f}` })
        .then(resolve)
        .catch(reject);
    };

    if (typeof window.initSqlJs === "function") {
      init();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-sql-js="1"]');
    if (existing) {
      existing.addEventListener("load", init);
      existing.addEventListener("error", () => reject(new Error("Failed to load sql-wasm.js")));
      return;
    }
    const script = document.createElement("script");
    script.src = "/sql-js/sql-wasm.js";
    script.dataset.sqlJs = "1";
    script.onload = init;
    script.onerror = () => reject(new Error("Failed to load sql-wasm.js"));
    document.head.appendChild(script);
  });

  return sqlPromise;
}

export function norm(s: string | null | undefined): string {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function qid(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

export function openDatabase(file: File): Promise<SqlJsDatabase> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const sql = await loadSqlJs();
        resolve(new sql.Database(new Uint8Array(reader.result as ArrayBuffer)));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsArrayBuffer(file);
  });
}

export function listTables(db: SqlJsDatabase): string[] {
  try {
    const r = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    return r[0] ? r[0].values.map((v) => String(v[0])) : [];
  } catch {
    return [];
  }
}

export function tableInfo(db: SqlJsDatabase, table: string): SqlColumn[] {
  try {
    const r = db.exec(`PRAGMA table_info(${qid(table)})`);
    return r[0] ? r[0].values.map((v) => ({ name: String(v[1]), type: String(v[2]) })) : [];
  } catch {
    return [];
  }
}

export function rowCount(db: SqlJsDatabase, table: string): number {
  try {
    const r = db.exec(`SELECT COUNT(*) FROM ${qid(table)}`);
    return r[0] ? Number(r[0].values[0][0]) : 0;
  } catch {
    return 0;
  }
}

function colMatch(cols: SqlColumn[], re: RegExp): string | null {
  const c = cols.find((c) => re.test(c.name));
  return c ? c.name : null;
}

export function guessColumnMap(cols: SqlColumn[]): ColumnMap {
  return {
    name: colMatch(cols, /^(full_?name|repo_?name|title|name|repository)$/i) ?? colMatch(cols, /title|name/i),
    readme: colMatch(cols, /^(readme|readme_?body|description_?long)$/i) ?? colMatch(cols, /readme/i),
    desc: colMatch(cols, /^(description|desc|summary|tagline)$/i),
    url: colMatch(cols, /^(html_?url|url|link|repo_?url)$/i),
    stars: colMatch(cols, /^(stargazers_?count|stars|star_?count|stargazers)$/i),
    dom: colMatch(cols, /domain|categor|topic|tag|cluster/i),
    role: colMatch(cols, /role|fit/i),
    prio: colMatch(cols, /prior|rank|score/i),
    lic: colMatch(cols, /licen/i),
    cols: cols.map((c) => c.name),
  };
}

export function guessRole(map: ColumnMap, cols: SqlColumn[]): TableRole {
  if (map.readme || (map.name && map.stars)) return "repo";
  if (map.dom || map.role || map.prio) return "classify";
  if (map.lic) return "rights";
  const joined = cols.map((c) => c.name.toLowerCase()).join(" ");
  if (/readme|stargazer|html_url/.test(joined)) return "repo";
  if (/domain|role|fit|prior/.test(joined)) return "classify";
  if (/licen/.test(joined)) return "rights";
  return "unknown";
}

export async function ingestFile(file: File): Promise<IngestedFile> {
  const db = await openDatabase(file);
  const tables: IngestedTable[] = listTables(db).map((name) => {
    const cols = tableInfo(db, name);
    const map = guessColumnMap(cols);
    return { name, cols, rows: rowCount(db, name), map, role: guessRole(map, cols), db };
  });
  return { fileName: file.name, db, tables };
}

function tablesByRole(files: IngestedFile[], role: TableRole): IngestedTable[] {
  return files.flatMap((f) => f.tables.filter((t) => t.role === role));
}

/** Reads the lightweight repo-identifying columns from every "repo"-role table across all ingested files. */
export function buildRepos(files: IngestedFile[]): RepoRecord[] {
  const repos: RepoRecord[] = [];

  for (const t of tablesByRole(files, "repo")) {
    const m = t.map;
    const select = [
      `${m.name ? qid(m.name) : "NULL"} AS _name`,
      `${m.readme ? "1" : "0"} AS _hasreadme`,
      `${m.url ? qid(m.url) : "NULL"} AS _url`,
      `${m.stars ? qid(m.stars) : "0"} AS _stars`,
      `${m.desc ? qid(m.desc) : "NULL"} AS _desc`,
    ];
    let rows;
    try {
      rows = t.db.exec(`SELECT ${select.join(",")} FROM ${qid(t.name)} LIMIT 5000`)[0];
    } catch {
      continue;
    }
    if (!rows) continue;

    rows.values.forEach((r, i) => {
      const name = String(r[0] ?? "").trim();
      if (!name) return;
      repos.push({
        id: `${t.name}::${i}::${norm(name)}`,
        name,
        stars: Number(r[3]) || 0,
        url: String(r[2] ?? ""),
        desc: String(r[4] ?? ""),
        hasReadme: !!Number(r[1]),
        classify: null,
        rights: null,
        _table: t,
        _rowIndex: i,
      });
    });
  }

  const classifyTables = tablesByRole(files, "classify");
  if (classifyTables.length) {
    const crows: { n: string; dom: unknown; role: unknown; prio: unknown }[] = [];
    for (const t of classifyTables) {
      const m = t.map;
      const select = [
        `${m.name ? qid(m.name) : "NULL"} AS _n`,
        `${m.dom ? qid(m.dom) : "NULL"} AS _dom`,
        `${m.role ? qid(m.role) : "NULL"} AS _role`,
        `${m.prio ? qid(m.prio) : "NULL"} AS _prio`,
      ];
      try {
        const r = t.db.exec(`SELECT ${select.join(",")} FROM ${qid(t.name)} LIMIT 5000`)[0];
        r?.values.forEach((v) => crows.push({ n: norm(String(v[0] ?? "")), dom: v[1], role: v[2], prio: v[3] }));
      } catch {
        // best-effort; a malformed classify table just contributes no assessment data
      }
    }
    for (const rp of repos) {
      const rn = norm(rp.name);
      const hit = crows.find((c) => c.n && c.n === rn) ?? crows.find((c) => c.n && rn.includes(c.n)) ?? crows.find((c) => c.n && c.n.includes(rn));
      if (hit) {
        rp.classify = {
          domains: String(hit.dom ?? "").split(/[,;|]/).map((s) => s.trim()).filter(Boolean),
          role: String(hit.role ?? ""),
          prio: String(hit.prio ?? ""),
          fuzzy: hit.n !== rn,
        };
      }
    }
  }

  const rightsTables = tablesByRole(files, "rights");
  if (rightsTables.length) {
    const rrows: { n: string; lic: unknown }[] = [];
    for (const t of rightsTables) {
      const m = t.map;
      const select = [`${m.name ? qid(m.name) : "NULL"} AS _n`, `${m.lic ? qid(m.lic) : "NULL"} AS _lic`];
      try {
        const r = t.db.exec(`SELECT ${select.join(",")} FROM ${qid(t.name)} LIMIT 5000`)[0];
        r?.values.forEach((v) => rrows.push({ n: norm(String(v[0] ?? "")), lic: v[1] }));
      } catch {
        // best-effort
      }
    }
    for (const rp of repos) {
      const rn = norm(rp.name);
      const hit = rrows.find((c) => c.n && c.n === rn) ?? rrows.find((c) => c.n && rn.includes(c.n));
      if (hit) rp.rights = { license: String(hit.lic ?? "") };
    }
  }

  return repos;
}

export function readReadme(rp: RepoRecord): string {
  const readmeCol = rp._table.map.readme;
  if (!readmeCol) return rp.desc || "";
  try {
    const r = rp._table.db.exec(`SELECT ${qid(readmeCol)} FROM ${qid(rp._table.name)} LIMIT 1 OFFSET ${rp._rowIndex}`);
    return r[0]?.values[0] ? String(r[0].values[0][0] ?? rp.desc ?? "") : rp.desc || "";
  } catch {
    return rp.desc || "";
  }
}
