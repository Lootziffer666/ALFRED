"use client";

import type { RepoRecord } from "@/lib/sqlite/types";
import type { Mode } from "@/lib/atoms/compose";
import type { SortKey } from "./useArchive";

export function RepoRegister({
  repos,
  totalRepos,
  mode,
  setMode,
  search,
  setSearch,
  sort,
  setSort,
  selectedRepoIds,
  toggleRepoSelection,
  activeRepoId,
  selectSingleRepo,
  light,
  onIlluminate,
  onStopIllumination,
}: {
  repos: RepoRecord[];
  totalRepos: number;
  mode: Mode;
  setMode: (m: Mode) => void;
  search: string;
  setSearch: (v: string) => void;
  sort: SortKey;
  setSort: (v: SortKey) => void;
  selectedRepoIds: Set<string>;
  toggleRepoSelection: (id: string) => void;
  activeRepoId: string | null;
  selectSingleRepo: (rp: RepoRecord) => void;
  light: { active: boolean; current: number; total: number; label: string };
  onIlluminate: () => void;
  onStopIllumination: () => void;
}) {
  const maxStars = Math.max(1, ...repos.map((r) => r.stars));

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 9, overflow: "hidden", background: "var(--ink2)" }}>
          <ModeButton label="Einzelstern" active={mode === "single"} onClick={() => setMode("single")} />
          <ModeButton label="Archiv ausleuchten" active={mode === "meta"} onClick={() => setMode("meta")} />
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Register durchsuchen …"
          style={{ flex: 1, minWidth: 160 }}
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={{ width: "auto" }}>
          <option value="stars">★ Helligkeit</option>
          <option value="az">A – Z</option>
          <option value="classified">Einordnung zuerst</option>
        </select>
        <span className="mono" style={{ fontSize: 10, color: "var(--mut)" }}>
          Register: <b style={{ color: "var(--brass)" }}>{repos.length}</b> / {totalRepos}
        </span>
        {mode === "meta" && (
          <button type="button" onClick={onIlluminate} style={{ fontSize: 11, padding: "7px 12px" }}>
            ☀ Archiv ausleuchten
          </button>
        )}
      </div>

      <div className="card-inset" style={{ marginTop: 12, maxHeight: 330, overflowY: "auto", padding: 12 }}>
        {repos.length === 0 ? (
          <div className="serif" style={{ fontStyle: "italic", color: "var(--mut)", fontSize: 13, padding: 18, textAlign: "center" }}>
            {totalRepos ? "Kein Treffer im Register." : "Noch keine Akten geöffnet."}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            {repos.map((r) => {
              const doms = r.classify?.domains.slice(0, 3) ?? [];
              const selected = selectedRepoIds.has(r.id);
              const active = activeRepoId === r.id;
              return (
                <div
                  key={r.id}
                  onClick={() => (mode === "meta" ? toggleRepoSelection(r.id) : selectSingleRepo(r))}
                  className="card-inset"
                  style={{
                    padding: "10px 11px",
                    cursor: "pointer",
                    borderColor: active ? "var(--zinnober)" : selected ? "var(--bordeaux)" : undefined,
                    position: "relative",
                  }}
                >
                  {mode === "meta" && (
                    <span
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        width: 15,
                        height: 15,
                        borderRadius: 4,
                        border: "1px solid var(--line)",
                        background: selected ? "rgba(156,47,68,.25)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        color: "var(--bordeaux)",
                      }}
                    >
                      {selected ? "✓" : ""}
                    </span>
                  )}
                  <div style={{ fontWeight: 600, fontSize: 12.5, lineHeight: 1.2, paddingRight: mode === "meta" ? 20 : 0 }}>{r.name}</div>
                  <div className="mono" style={{ fontSize: 9, color: "var(--mut)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {(r.url || r.desc || "").slice(0, 46)}
                  </div>
                  <div style={{ height: 4, borderRadius: 3, background: "#1c1813", marginTop: 8, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.max(4, (r.stars / maxStars) * 100)}%`, background: "linear-gradient(90deg,var(--brass-d),var(--brass-l))" }} />
                  </div>
                  <div className="mono" style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 9, color: "var(--mut)" }}>
                    <span style={{ color: "var(--brass-l)" }}>★ {r.stars}</span>
                    <span>{r.hasReadme ? "README" : "desc"}</span>
                  </div>
                  {doms.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 6 }}>
                      {doms.map((d, i) => (
                        <span key={i} className="mono" style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4, background: "#1c1813", border: "1px solid var(--line)", color: "var(--paper-dim)" }}>
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {light.active && (
        <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span className="mono" style={{ fontSize: 10, color: "var(--mut)" }}>
            lese {light.current}/{light.total} · {light.label}
          </span>
          <div style={{ flex: 1, height: 6, borderRadius: 4, background: "#1c1813", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${(light.current / light.total) * 100}%`, background: "linear-gradient(90deg,var(--bordeaux-d),var(--bordeaux))" }} />
          </div>
          <button type="button" onClick={onStopIllumination} style={{ fontSize: 10.5, padding: "5px 11px" }}>■ abbrechen</button>
        </div>
      )}
    </div>
  );
}

function ModeButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mono"
      style={{
        padding: "8px 14px",
        fontSize: 10,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
        border: "none",
        borderRadius: 0,
        background: active ? "linear-gradient(180deg, rgba(156,47,68,.18), rgba(156,47,68,.05))" : "transparent",
        color: active ? "#e7a9b6" : "var(--mut)",
      }}
    >
      {label}
    </button>
  );
}
