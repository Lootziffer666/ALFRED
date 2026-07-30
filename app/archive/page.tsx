"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useArchive } from "@/components/archive/useArchive";
import { SchemaCard } from "@/components/archive/SchemaCard";
import { RepoRegister } from "@/components/archive/RepoRegister";
import { Winkelhaken } from "@/components/archive/Winkelhaken";
import { Karte } from "@/components/archive/Karte";
import { Karte3D } from "@/components/archive/Karte3D";
import { ReportView } from "@/components/archive/ReportView";
import { CueTooltip, useCueTooltip } from "@/components/archive/CueTooltip";
import { Flur } from "@/components/archive/Flur";

const LEVEL_LABELS: { lvl: 1 | 2 | 3 | 4; numeral: string; name: string }[] = [
  { lvl: 1, numeral: "I", name: "Amtsarzt" },
  { lvl: 2, numeral: "II", name: "Gericht" },
  { lvl: 3, numeral: "III", name: "Existenz." },
  { lvl: 4, numeral: "IV", name: "Verfall" },
];

const LEVEL_NAMES: Record<1 | 2 | 3 | 4, string> = {
  1: "Der Amtsarzt",
  2: "Das Verfassungsgericht",
  3: "Der Existenzialist",
  4: "Der Protokollant des Verfalls",
};

export default function ArchivePage() {
  const a = useArchive();
  const { tooltip, showCue, hideCue } = useCueTooltip();
  const [dragOver, setDragOver] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(true);
  const [karteMode, setKarteMode] = useState<"2d" | "3d">("3d");
  const fileInputRef = useRef<HTMLInputElement>(null);


  const unusedIds = new Set<string>();
  if (a.reportMode === "ki" && a.report) {
    const usedIds = new Set(
      a.report.flatMap((ph) => ph.paragraphs.flatMap((p) => p.tags.filter((t) => t.kind === "ok").map((t) => t.label))),
    );
    a.atoms.forEach((atom) => {
      if (!usedIds.has(atom.id)) unusedIds.add(atom.id);
    });
  }

  const coverage = a.atoms.length ? Math.round((a.atoms.filter((x) => !x.hyp).length / a.atoms.length) * 100) : 0;
  const allTables = a.files.flatMap((f) => f.tables);

  return (
    <div className="raum-viii">
      <div className="kasten-bg" />
      <div className="vign" />
      <div className="walze" />
      <Flur />
      <div className="raum-content" style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 14px 60px", width: "100%" }}>
      <header style={{ marginBottom: 16 }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.15em", color: "var(--bordeaux)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span className="dot" style={{ background: "var(--zinnober)" }} />
          ALFRED · Raum VIII · Skriptorium
          <Link href="/" className="pill" style={{ color: "var(--brass-l)", borderColor: "var(--brass-d)", textDecoration: "none" }}>
            ← zum Repository-Butler
          </Link>
        </div>
        <h1 style={{ fontSize: "clamp(28px, 6vw, 44px)", margin: "6px 0 0", lineHeight: 1.05 }}>
          Die <span style={{ color: "var(--zinnober)" }}>Setzmaschine</span>, die <span style={{ color: "var(--bordeaux)" }}>liest</span>, was daliegt.
        </h1>
        <p className="serif" style={{ color: "var(--paper-dim)", fontSize: 14, maxWidth: "68ch", marginTop: 8 }}>
          Zieh eine SQLite-Datenbank deiner gestarrten Repos herein (z.B. die im Repo mitgelieferte{" "}
          <code className="mono">sternkarte.sqlite</code>). Alfred inspiziert das Schema, baut ein Register, und setzt
          aus belegten Signalen einen CUE-geprüften Prüfbericht — Einzelstern oder ganzes Archiv.
        </p>
      </header>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setSchemaOpen((v) => !v)}>
          <h2 style={{ fontSize: 20, margin: 0 }}><span className="mono" style={{ fontSize: 11, color: "var(--zinnober)" }}>§ 0</span> Die Aktenlage · SQLite lesen</h2>
          <span className="mono" style={{ color: "var(--mut)", transform: schemaOpen ? "rotate(90deg)" : "none" }}>▾</span>
        </div>

        {schemaOpen && (
          <div style={{ marginTop: 14 }}>
            <label
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); a.handleFiles(e.dataTransfer.files); }}
              className="card-inset"
              style={{
                display: "block",
                border: `1.5px dashed ${dragOver ? "var(--brass-l)" : "var(--brass-d)"}`,
                borderRadius: 11,
                padding: 20,
                textAlign: "center",
                cursor: "pointer",
                background: dragOver ? "rgba(216,178,94,.12)" : "rgba(183,138,62,.03)",
              }}
            >
              <div style={{ fontSize: 26, color: "var(--brass)" }}>⛁</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--paper-dim)", marginTop: 7 }}>DB hereinziehen oder klicken</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--mut)", marginTop: 4 }}>
                {a.files.length ? a.files.map((f) => f.fileName).join(", ") : "Observatory / sternkarte.sqlite / starred-repos export …"}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".sqlite,.db,.sqlite3"
                multiple
                style={{ display: "none" }}
                onChange={(e) => e.target.files && a.handleFiles(e.target.files)}
              />
            </label>

            <p
              className="mono"
              style={{ fontSize: 10.5, color: a.dbStatus.kind === "err" ? "var(--zinnober)" : a.dbStatus.kind === "ok" ? "var(--ok)" : "var(--mut)", marginTop: 12, lineHeight: 1.6 }}
            >
              {a.dbStatus.html}
            </p>

            {allTables.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--brass-d)", marginBottom: 9 }}>
                  Karteikasten · erkanntes Schema (Rolle & Spalten-Mapping korrigierbar)
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {allTables.map((t, i) => (
                    <SchemaCard key={i} table={t} onRoleChange={a.updateTableRole} onColumnChange={a.updateColumnMapping} />
                  ))}
                </div>
              </div>
            )}

            <RepoRegister
              repos={a.filteredSortedRepos}
              totalRepos={a.repos.length}
              mode={a.mode}
              setMode={a.setMode}
              search={a.search}
              setSearch={a.setSearch}
              sort={a.sort}
              setSort={a.setSort}
              selectedRepoIds={a.selectedRepoIds}
              toggleRepoSelection={a.toggleRepoSelection}
              activeRepoId={a.activeRepoId}
              selectSingleRepo={a.selectSingleRepo}
              light={a.light}
              onIlluminate={a.runArchiveIllumination}
              onStopIllumination={a.stopIllumination}
            />
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 20, marginTop: 18 }}>
        <div className="mono" style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mut)", display: "flex", justifyContent: "space-between", marginBottom: 9 }}>
          <span>Ausleuchtungsstufe</span>
          <b style={{ color: "var(--brass)" }}>{LEVEL_NAMES[a.level]}</b>
        </div>
        <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", background: "var(--ink2)" }}>
          {LEVEL_LABELS.map(({ lvl, numeral, name }) => (
            <button
              key={lvl}
              type="button"
              onClick={() => a.setLevel(lvl)}
              className="mono"
              style={{
                flex: 1,
                textAlign: "center",
                padding: "11px 4px 9px",
                fontSize: 9.5,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
                border: "none",
                borderRight: "1px solid var(--line)",
                borderRadius: 0,
                background: a.level === lvl ? "linear-gradient(180deg, rgba(214,64,44,.16), rgba(214,64,44,.04))" : "transparent",
                color: a.level === lvl ? "var(--paper)" : "var(--mut)",
              }}
            >
              <span style={{ display: "block", fontSize: 16, marginBottom: 3, color: a.level === lvl ? "var(--zinnober)" : "var(--paper-dim)" }}>{numeral}</span>
              {name}
            </button>
          ))}
        </div>

        <details style={{ marginTop: 16 }}>
          <summary className="mono" style={{ fontSize: 12, cursor: "pointer", color: "var(--paper-dim)" }}>Manuell nachfüttern (ohne DB)</summary>
          <p className="serif" style={{ fontSize: 12.5, color: "var(--paper-dim)", marginTop: 8 }}>
            Für Signale, die in keiner DB stehen – oder wenn du ohne SQLite arbeitest.
          </p>
          <div className="feed-grid" style={{ gap: 14, marginTop: 8 }}>
            <ManualField label="README / Beschreibung" value={a.manual.readme} onChange={(v) => a.setManual((m) => ({ ...m, readme: v }))} />
            <ManualField label="Verfassungs-/Regel-Datei" value={a.manual.const} onChange={(v) => a.setManual((m) => ({ ...m, const: v }))} />
            <ManualField label="Ordnerbaum" value={a.manual.tree} onChange={(v) => a.setManual((m) => ({ ...m, tree: v }))} />
            <ManualField label="Commit- & PR-Titel" value={a.manual.commits} onChange={(v) => a.setManual((m) => ({ ...m, commits: v }))} />
          </div>
          <div style={{ marginTop: 14, marginBottom: 8 }}>
            <ManualField label="Konventionen / Marker / States" value={a.manual.conv} onChange={(v) => a.setManual((m) => ({ ...m, conv: v }))} />
          </div>
          <button type="button" className="primary" onClick={a.feedManual}>⚙ Aus Signalen setzen</button>
        </details>
      </div>

      <Winkelhaken atoms={a.atoms} mode={a.mode} unusedIds={unusedIds} onHover={showCue} onLeave={hideCue} />

      <div className="tools" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 16 }}>
        <button type="button" className="primary" disabled={a.kiLoading} onClick={() => a.press(false)}>⚙ Pressen & setzen</button>
        <button type="button" disabled={a.kiLoading} onClick={() => a.press(true)}>{a.kiLoading ? "✒ setzt live …" : "✒ Mit KI setzen"}</button>
        <button type="button" onClick={a.loadDemo}>↺ SHADED-Demo</button>
        <button type="button" onClick={() => copySpec(a)}>⤓ 3D-Spec</button>
        <button type="button" onClick={() => copyReport(a.report)}>⧉ Bericht</button>
        <span style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 11, color: "var(--mut)" }}>
          Atome <b style={{ color: "var(--brass)" }}>{a.atoms.length}</b> · belegt <b style={{ color: "var(--brass)" }}>{coverage}%</b> · KI-Sätze{" "}
          <span style={{ color: "var(--bordeaux)" }}>{a.kiStats.ki}</span> · widersprochen <span style={{ color: "var(--bordeaux)" }}>{a.kiStats.bad}</span>
        </span>
      </div>

      <div className="grid2" style={{ gap: 24, marginTop: 24 }}>
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ fontSize: 20, margin: "0 0 4px" }}><span className="mono" style={{ fontSize: 11, color: "var(--zinnober)" }}>§ A</span> Die Karte</h2>
            <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
              <button
                type="button"
                onClick={() => setKarteMode("3d")}
                className="mono"
                style={{ fontSize: 10, padding: "6px 10px", border: "none", borderRadius: 0, background: karteMode === "3d" ? "rgba(183,138,62,.16)" : "transparent", color: karteMode === "3d" ? "var(--brass-l)" : "var(--mut)", minHeight: "auto" }}
              >
                3D
              </button>
              <button
                type="button"
                onClick={() => setKarteMode("2d")}
                className="mono"
                style={{ fontSize: 10, padding: "6px 10px", border: "none", borderRadius: 0, background: karteMode === "2d" ? "rgba(183,138,62,.16)" : "transparent", color: karteMode === "2d" ? "var(--brass-l)" : "var(--mut)", minHeight: "auto" }}
              >
                2D
              </button>
            </div>
          </div>
          <p className="mono" style={{ fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--mut)", margin: "0 0 13px" }}>
            deterministisch aus Atomen · gestrichelt/durchsichtig = Hypothese {karteMode === "3d" && "· ziehen zum Drehen, scrollen zum Zoomen"}
          </p>
          <div className="card" style={{ padding: 8 }}>
            {karteMode === "3d" ? (
              <Karte3D atoms={a.atoms} mode={a.mode} onHover={showCue} onLeave={hideCue} />
            ) : (
              <Karte atoms={a.atoms} mode={a.mode} onHover={showCue} onLeave={hideCue} />
            )}
          </div>
        </section>
        <section>
          <h2 style={{ fontSize: 20, margin: "0 0 4px" }}><span className="mono" style={{ fontSize: 11, color: "var(--zinnober)" }}>§ B</span> Der Prüfbericht</h2>
          <p className="mono" style={{ fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--mut)", margin: "0 0 13px" }}>
            KI-Prosa, CUE-kodiert · Schein → Verfassung → Behörden → Paradoxa → Quintessenz
          </p>
          <div className="card bericht-card" style={{ padding: "24px 26px" }}>
            {a.report && <div key={a.reportVersion} className="ink-pulse" />}
            {a.kiLoading && a.kiLiveText && (
              <p className="serif" style={{ fontStyle: "italic", color: "var(--paper-dim)", fontSize: 14, whiteSpace: "pre-wrap" }}>{a.kiLiveText}</p>
            )}
            <ReportView phases={a.report} mode={a.reportMode} />
          </div>
        </section>
      </div>

      <div className="card" style={{ marginTop: 22, padding: "13px 16px", borderColor: "var(--bordeaux-d)" }}>
        <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--bordeaux)", marginBottom: 10 }}>
          Wahrheits-Schichten · jede Aussage trägt ihre Herkunft
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <TruthLayer color="var(--brass)" label="SOURCE" desc="SQLite-Spalte / Atom" />
          <TruthLayer color="var(--bordeaux)" label="INFERENCE" desc="KI-Schluss (getaggt)" />
          <TruthLayer color="var(--ok)" label="ASSESSMENT" desc="deine Einordnung" />
          <TruthLayer color="var(--hyp)" label="HYPOTHESE" desc="unbelegt, ehrlich offen" />
          <TruthLayer color="var(--zinnober)" label="WIDERSPRUCH" desc="KI ohne Atom" />
        </div>
      </div>

      <div className="card" style={{ marginTop: 22 }}>
        <div className="sh" style={{ padding: "13px 18px" }}>
          <h3 style={{ fontSize: 18, margin: 0 }}>KI-Setzer · Endpoint (Cloud oder lokal)</h3>
        </div>
        <div style={{ padding: "0 18px 18px", borderTop: "1px solid var(--line)" }}>
          <div className="settings-grid" style={{ gap: 12, marginTop: 14 }}>
            <LabeledInput label="Endpoint (OpenAI-kompatibel)" value={a.cfg.endpoint} onChange={(v) => a.setCfg((c) => ({ ...c, endpoint: v }))} placeholder="https://openrouter.ai/api/v1  oder  http://localhost:11434/v1" />
            <LabeledInput label="Modell" value={a.cfg.model} onChange={(v) => a.setCfg((c) => ({ ...c, model: v }))} placeholder="gpt-4o-mini / llama3.1" />
            <LabeledInput label="API-Key (bleibt nur im Tab)" value={a.cfg.key} onChange={(v) => a.setCfg((c) => ({ ...c, key: v }))} placeholder="sk-… · bei Ollama oft leer" type="password" />
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
            <Toggle label="KI-Setzer aktiv (sonst nur Fallback-Skelett)" on={a.cfg.ki} onClick={() => a.setCfg((c) => ({ ...c, ki: !c.ki }))} />
            <Toggle label="Streaming (live setzen)" on={a.cfg.stream} onClick={() => a.setCfg((c) => ({ ...c, stream: !c.stream }))} />
            <button type="button" onClick={a.testConnection} style={{ marginLeft: "auto" }}>⚡ Verbindung testen</button>
          </div>
          {a.testResult && <p className="mono" style={{ fontSize: 11, marginTop: 8 }}>{a.testResult}</p>}
          <p className="serif" style={{ fontStyle: "italic", fontSize: 12.5, color: "var(--paper-dim)", marginTop: 13 }}>
            <b style={{ color: "var(--brass-l)", fontStyle: "normal" }}>Offline-First:</b> Dasselbe <code className="mono">/v1/chat/completions</code>-Format
            sprechen Ollama, LM-Studio, vLLM, llama.cpp lokal, und OpenRouter/OpenAI in der Cloud. Der Call geht direkt aus
            deinem Browser an den Endpoint — nichts läuft über einen Server dieser App. Der Key wird nie gespeichert.
          </p>
        </div>
      </div>

      {a.toastMsg && (
        <div
          style={{
            position: "fixed",
            zIndex: 70,
            left: "50%",
            bottom: 26,
            transform: "translateX(-50%)",
            background: "#1c1408",
            border: "1px solid var(--bordeaux-d)",
            color: "#f0d9a8",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            padding: "10px 16px",
            borderRadius: 10,
            maxWidth: "88vw",
            textAlign: "center",
          }}
        >
          {a.toastMsg}
        </div>
      )}

      <CueTooltip tooltip={tooltip} mode={a.mode} />
      </div>
    </div>
  );
}

function ManualField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: "block" }}>
      <span className="mono" style={{ display: "block", fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--mut)", marginBottom: 4 }}>{label}</span>
      <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function LabeledInput({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="mono" style={{ display: "block", fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--mut)", marginBottom: 4 }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <span onClick={onClick} className="mono" style={{ display: "inline-flex", alignItems: "center", gap: 9, fontSize: 11, color: "var(--paper-dim)", cursor: "pointer" }}>
      <span style={{ width: 38, height: 20, borderRadius: 11, background: on ? "var(--bordeaux-d)" : "#2a2620", position: "relative", transition: "background .2s" }}>
        <span style={{ position: "absolute", top: 2, left: on ? 20 : 2, width: 16, height: 16, borderRadius: "50%", background: on ? "#f0c4ba" : "var(--mut)", transition: "left .2s" }} />
      </span>
      {label}
    </span>
  );
}

function TruthLayer({ color, label, desc }: { color: string; label: string; desc: string }) {
  return (
    <span className="mono" style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 9.5, color: "var(--paper-dim)", padding: "5px 10px", border: "1px solid var(--line)", borderRadius: 20 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      <b style={{ color: "var(--paper)" }}>{label}</b> {desc}
    </span>
  );
}

function buildSpec(a: ReturnType<typeof useArchive>) {
  const groups: Record<string, string> = {
    verfassung: "#e0b257", weltgesetze: "#b6c24a", verfahren: "#cf6aa8", konzept: "#9aa0ad", forensik: "#d65a6a",
  };
  const catToGroup: Record<string, string> = { authority: "verfassung", causality: "weltgesetze", adjudication: "verfahren", epistemic: "konzept" };
  interface SpecNode {
    id: string;
    label: string;
    group: string;
    rel: Record<string, { to: string; conf: number; ev: string[]; unresolved: boolean }[]>;
    gloss?: string;
    note?: string[];
  }
  const nodes: SpecNode[] = a.atoms.map((atom) => ({
    id: atom.id,
    label: atom.id.replace(/_/g, " ") + (a.mode === "meta" && atom.count ? ` (×${atom.count})` : ""),
    group: catToGroup[atom.cat] ?? "konzept",
    rel: {
      ESTABLISHES: atom.evidence.map((e, i) => ({
        to: `ev_${atom.id}_${i}`,
        conf: atom.hyp ? 0.4 : 0.9,
        ev: [e.k.toLowerCase().includes("commit") ? "precedent" : e.k.toLowerCase().includes("pr") ? "review" : e.k.toLowerCase().includes("archiv") ? "ci" : "charter"],
        unresolved: atom.hyp,
      })),
    },
    gloss: a.mode === "meta" && atom.metaSentence ? atom.metaSentence : atom.trope[a.level],
    note: [atom.trope[2]],
  }));
  a.atoms.forEach((atom) => atom.evidence.forEach((e, i) => nodes.push({ id: `ev_${atom.id}_${i}`, label: `${e.k}: ${e.v.slice(0, 30)}`, group: "forensik", rel: {} })));

  return {
    meta: { kicker: `ALFRED · Raum VIII · ${a.mode === "meta" ? "Archiv" : "Einzelstern"} · Stufe ${a.level}`, h1: "Aus Atomen gesetzt." },
    groups,
    rel_roles: { ESTABLISHES: { de: "ESTABLISHES / belegt", color: "#7fae6a", cat: "adjudication" } },
    nodes,
    links: [],
  };
}

async function copySpec(a: ReturnType<typeof useArchive>) {
  const text = JSON.stringify(buildSpec(a), null, 2);
  try {
    await navigator.clipboard.writeText(text);
    a.toast("3D-Spec kopiert – in build_graph.py / 3D-Engine einsetzbar.");
  } catch {
    a.toast("Kopieren fehlgeschlagen.");
  }
}

async function copyReport(phases: ReturnType<typeof useArchive>["report"]) {
  if (!phases) return;
  const numerals = ["I", "II", "III", "IV", "V"];
  const text = phases
    .map((ph) => {
      const heading = `§ ${numerals[ph.index]} · ${ph.title}`;
      const body = [ph.banner, ...ph.paragraphs.map((p) => p.text), ph.warn].filter(Boolean).join("\n");
      return `${heading}\n${body}`;
    })
    .join("\n\n");
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // clipboard unavailable; nothing else to fall back to here
  }
}
