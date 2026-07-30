"use client";

import type { ColumnMap, IngestedTable, TableRole } from "@/lib/sqlite/types";

const ROLE_OPTIONS: [TableRole, string][] = [
  ["repo", "REPO-QUELLE (name/readme/stars)"],
  ["classify", "EINORDNUNG (Domäne/Rolle/Prio)"],
  ["rights", "RECHTE (Lizenz)"],
  ["unknown", "UNBEKANNT"],
];

const SLOTS: Record<TableRole, [keyof ColumnMap, string][]> = {
  repo: [
    ["name", "NAME"],
    ["readme", "README"],
    ["stars", "★ STARS"],
    ["url", "URL"],
    ["desc", "DESC"],
  ],
  classify: [
    ["name", "NAME"],
    ["dom", "DOMÄNE"],
    ["role", "ROLLE"],
    ["prio", "PRIO"],
  ],
  rights: [
    ["name", "NAME"],
    ["lic", "LIZENZ"],
  ],
  unknown: [],
};

export function SchemaCard({
  table,
  onRoleChange,
  onColumnChange,
}: {
  table: IngestedTable;
  onRoleChange: (table: IngestedTable, role: TableRole) => void;
  onColumnChange: (table: IngestedTable, slot: keyof ColumnMap, value: string) => void;
}) {
  const slots = SLOTS[table.role];
  return (
    <div className="card-inset" style={{ padding: "11px 12px", flex: 1, minWidth: 230 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <span className="mono" style={{ fontSize: 11, color: "var(--brass-l)", fontWeight: 600 }}>{table.name}</span>
        <span className="mono" style={{ fontSize: 9.5, color: "var(--mut)" }}>{table.rows} Z.</span>
      </div>

      <div style={{ marginTop: 8 }}>
        <label className="mono" style={{ display: "block", fontSize: 8.5, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--mut)", marginBottom: 3 }}>
          Rolle dieser Tabelle
        </label>
        <select value={table.role} onChange={(e) => onRoleChange(table, e.target.value as TableRole)}>
          {ROLE_OPTIONS.map(([v, label]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
        {table.cols.map((c) => {
          const as = slots.find(([slot]) => table.map[slot] === c.name);
          return (
            <div key={c.name} className="mono" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9.5 }}>
              <span style={{ color: "var(--paper-dim)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.name}>
                {c.name}
              </span>
              <span style={{ fontSize: 8, letterSpacing: "0.5px", textTransform: "uppercase", padding: "1px 5px", borderRadius: 4, border: "1px solid var(--line)", color: as ? "var(--brass-l)" : "var(--mut)" }}>
                {as ? as[1] : "–"}
              </span>
            </div>
          );
        })}
      </div>

      {slots.length > 0 && (
        <div className="mono" style={{ marginTop: 7, fontSize: 8.5, color: "var(--mut)" }}>
          Spalten-Mapping:
          {slots.map(([slot, label]) => (
            <div key={slot} style={{ margin: "3px 0" }}>
              <span style={{ color: "var(--paper-dim)" }}>{label}</span>{" "}
              <select value={table.map[slot] ?? ""} onChange={(e) => onColumnChange(table, slot, e.target.value)} style={{ display: "inline-block", width: "auto" }}>
                <option value="">–</option>
                {table.cols.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
