"use client";

import { useState } from "react";
import Link from "next/link";
import { generateReport, type ReportResponse } from "@/lib/client/api";
import { implementedModes } from "@/lib/report/modes";
import { LEVELS } from "@/lib/atoms/data";
import { ReportView } from "@/components/report/ReportView";
import { SourceStatus } from "@/components/report/SourceStatus";
import { IcebergCta } from "@/components/report/IcebergCta";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: ReportResponse };

const MODES = implementedModes();
const LEVEL_IDS = [1, 2, 3, 4] as const;
const LEVEL_NUMERALS: Record<1 | 2 | 3 | 4, string> = { 1: "I", 2: "II", 3: "III", 4: "IV" };

export default function ReportPage() {
  const [repo, setRepo] = useState("");
  const [ref, setRef] = useState("");
  const [mode, setMode] = useState(MODES[0].id);
  const [level, setLevel] = useState<1 | 2 | 3 | 4>(MODES[0].defaultLevel);
  const [state, setState] = useState<State>({ kind: "idle" });

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!repo.trim()) {
      setState({ kind: "error", message: "Bitte ein öffentliches GitHub-Repository angeben." });
      return;
    }
    setState({ kind: "loading" });
    const result = await generateReport({
      repo: repo.trim(),
      ref: ref.trim() || undefined,
      mode,
      level,
    });
    setState(result.ok ? { kind: "ready", data: result.data } : { kind: "error", message: result.error });
  }

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "28px 16px 72px", width: "100%" }}>
      <header style={{ marginBottom: 22 }}>
        <div
          className="mono"
          style={{ fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--bordeaux)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
        >
          <span className="dot" style={{ background: "var(--zinnober)" }} />
          ALFRET · Öffentlicher Bericht
          <Link className="pill" href="/">Repository-Butler</Link>
          <Link className="pill" href="/archive">Raum VIII · Skriptorium</Link>
        </div>

        <h1 className="serif" style={{ fontSize: 30, margin: "12px 0 8px", color: "var(--paper)" }}>
          Andere Werkzeuge untersuchen ein Repository, um einen Bericht zu schreiben.
        </h1>
        <p style={{ color: "var(--paper-dim)", margin: 0, lineHeight: 1.6, fontSize: 15 }}>
          ALFRET schreibt einen Bericht, weil es das Repository ohnehin verstehen muss. Gib ein
          öffentliches Repository an — kein Token, keine Berechtigungen, kein Modell.
        </p>
      </header>

      <form onSubmit={run} className="card" style={{ padding: 16, display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--paper-dim)" }}>Öffentliches GitHub-Repository</span>
          <input
            type="text"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            placeholder="owner/repo oder https://github.com/owner/repo"
            aria-label="Öffentliches GitHub-Repository"
          />
        </label>

        <div className="grid2" style={{ gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--paper-dim)" }}>Ref (optional)</span>
            <input
              type="text"
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder="Standardbranch"
              aria-label="Ref"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--paper-dim)" }}>Modus</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)} aria-label="Reportmodus">
              {MODES.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </label>
        </div>

        <fieldset style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px", margin: 0 }}>
          <legend className="mono" style={{ fontSize: 11, color: "var(--paper-dim)", padding: "0 6px" }}>Tonstufe</legend>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {LEVEL_IDS.map((id) => (
              <label key={id} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, color: "var(--paper)" }}>
                <input type="radio" name="level" checked={level === id} onChange={() => setLevel(id)} />
                {LEVEL_NUMERALS[id]} · {LEVELS[id].name}
              </label>
            ))}
          </div>
        </fieldset>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" disabled={state.kind === "loading"}>
            {state.kind === "loading" ? "Liest…" : "Bericht erzeugen"}
          </button>
          <span className="mono" style={{ fontSize: 11, color: "var(--mut)" }}>
            {MODES.find((m) => m.id === mode)?.summary}
          </span>
        </div>
      </form>

      {state.kind === "error" ? (
        <p
          role="alert"
          className="card"
          style={{ padding: 14, marginTop: 16, color: "var(--zinnober)", borderColor: "var(--zinnober)", fontSize: 14, lineHeight: 1.55 }}
        >
          {state.message}
        </p>
      ) : null}

      {state.kind === "loading" ? (
        <p className="mono" style={{ marginTop: 16, color: "var(--paper-dim)", fontSize: 13 }}>
          Repository wird gelesen, Regeln werden ausgewertet…
        </p>
      ) : null}

      {state.kind === "ready" ? (
        <div style={{ marginTop: 24, display: "grid", gap: 22 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <a className="mono" href={state.data.repo.url} target="_blank" rel="noreferrer noopener" style={{ fontSize: 14, color: "var(--brass-l)" }}>
              {state.data.repo.owner}/{state.data.repo.name}
            </a>
            <span className="mono" style={{ fontSize: 11, color: "var(--mut)" }}>
              @{state.data.repo.ref} · {state.data.report.atomIds.length} belegte Befunde · Stufe {state.data.report.level}
            </span>
          </div>

          <SourceStatus sources={state.data.sources} warnings={state.data.warnings} />
          <ReportView report={state.data.report} />
          <IcebergCta />
        </div>
      ) : null}
    </main>
  );
}
