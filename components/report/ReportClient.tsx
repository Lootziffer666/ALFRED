"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { generateReport } from "@/lib/client/api";
import { parseShareParams } from "@/lib/report/export";
import { REPORT_MODES, implementedModes, type Report, type ReportMode } from "@/lib/report/modes";
import type { SignalSource } from "@/lib/report/signals";
import { REPORT_FIXTURES, fixtureReport } from "@/lib/report/fixtures";
import { LEVELS } from "@/lib/atoms/data";
import { ReportView } from "./ReportView";
import { SourceStatus } from "./SourceStatus";
import { AssessmentCard } from "./AssessmentCard";
import { ExportBar } from "./ExportBar";
import { IcebergCta } from "./IcebergCta";

const MODES = implementedModes();
const LEVEL_IDS = [1, 2, 3, 4] as const;
const LEVEL_NUMERALS: Record<1 | 2 | 3 | 4, string> = { 1: "I", 2: "II", 3: "III", 4: "IV" };

interface Loaded {
  report: Report;
  sources: SignalSource[];
  warnings: string[];
  repoUrl?: string;
  fixtureNote?: string;
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; data: Loaded };

export function ReportClient() {
  const params = useSearchParams();
  // Derived at first render, not assigned from an effect: a share link is part
  // of the initial state, not a later change to it.
  const shared = useMemo(() => parseShareParams(params, MODES[0].id), [params]);

  const [repo, setRepo] = useState(shared?.repo ?? "");
  const [ref, setRef] = useState(shared?.ref ?? "");
  const [mode, setMode] = useState<ReportMode>(shared?.mode ?? MODES[0].id);
  const [level, setLevel] = useState<1 | 2 | 3 | 4>(shared?.level ?? MODES[0].defaultLevel);
  const [state, setState] = useState<State>(shared ? { kind: "loading" } : { kind: "idle" });
  const autoRan = useRef(false);

  const load = useCallback(async (next: { repo: string; ref?: string; mode: ReportMode; level: 1 | 2 | 3 | 4 }) => {
    const result = await generateReport({
      repo: next.repo.trim(),
      ref: next.ref?.trim() || undefined,
      mode: next.mode,
      level: next.level,
    });
    setState(
      result.ok
        ? {
            kind: "ready",
            data: {
              report: result.data.report,
              sources: result.data.sources,
              warnings: result.data.warnings,
              repoUrl: result.data.repo.url,
            },
          }
        : { kind: "error", message: result.error },
    );
  }, []);

  /** A share link carries repo, ref, mode and level — the report is rebuilt here. */
  useEffect(() => {
    if (autoRan.current || !shared) return;
    autoRan.current = true;
    void load(shared);
  }, [shared, load]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!repo.trim()) {
      setState({ kind: "error", message: "Bitte ein öffentliches GitHub-Repository angeben." });
      return;
    }
    setState({ kind: "loading" });
    void load({ repo, ref, mode, level });
  }

  function onModeChange(next: ReportMode) {
    setMode(next);
    setLevel(REPORT_MODES[next].defaultLevel);
  }

  function loadFixture(id: string) {
    const fixture = REPORT_FIXTURES.find((f) => f.id === id);
    if (!fixture) return;
    setRepo(`${fixture.repo.owner}/${fixture.repo.name}`);
    setRef(fixture.repo.ref ?? "");
    setState({
      kind: "ready",
      data: {
        report: fixtureReport(fixture, mode, level),
        sources: [],
        warnings: [],
        fixtureNote: `Beispiel-Signale, kein Abruf: ${fixture.note}`,
      },
    });
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
          <Link className="pill" href="/homelab">Raum IX · Werkstatt</Link>
          <Link className="pill" href="/workshop">Workshop</Link>
        </div>

        <h1 className="serif" style={{ fontSize: 30, margin: "12px 0 8px", color: "var(--paper)" }}>
          Andere Werkzeuge untersuchen ein Repository, um einen Bericht zu schreiben.
        </h1>
        <p style={{ color: "var(--paper-dim)", margin: 0, lineHeight: 1.6, fontSize: 15 }}>
          ALFRET schreibt einen Bericht, weil es das Repository ohnehin verstehen muss. Gib ein
          öffentliches Repository an — kein Token, keine Berechtigungen, kein Modell.
        </p>
      </header>

      <form onSubmit={submit} className="card" style={{ padding: 16, display: "grid", gap: 12 }}>
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
            <input type="text" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Standardbranch" aria-label="Ref" />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--paper-dim)" }}>Modus</span>
            <select value={mode} onChange={(e) => onModeChange(e.target.value as ReportMode)} aria-label="Reportmodus">
              {MODES.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </label>
        </div>

        {REPORT_MODES[mode].usesLevel !== false ? (
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
        ) : null}

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button type="submit" disabled={state.kind === "loading"}>
            {state.kind === "loading" ? "Liest…" : "Bericht erzeugen"}
          </button>
          <span className="mono" style={{ fontSize: 11, color: "var(--mut)" }}>
            {REPORT_MODES[mode].summary}
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", borderTop: "1px solid var(--line)", paddingTop: 10 }}>
          <span className="mono" style={{ fontSize: 11, color: "var(--mut)" }}>Ohne Abruf ansehen:</span>
          {REPORT_FIXTURES.map((f) => (
            <button key={f.id} type="button" className="ghost" onClick={() => loadFixture(f.id)}>
              {f.label}
            </button>
          ))}
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
            {state.data.repoUrl ? (
              <a className="mono" href={state.data.repoUrl} target="_blank" rel="noreferrer noopener" style={{ fontSize: 14, color: "var(--brass-l)" }}>
                {state.data.report.repo.owner}/{state.data.report.repo.name}
              </a>
            ) : (
              <span className="mono" style={{ fontSize: 14, color: "var(--brass-l)" }}>
                {state.data.report.repo.owner}/{state.data.report.repo.name}
              </span>
            )}
            <span className="mono" style={{ fontSize: 11, color: "var(--mut)" }}>
              {REPORT_MODES[state.data.report.mode].label} · {state.data.report.atomIds.length} belegte Befunde · Stufe {state.data.report.level}
            </span>
          </div>

          {state.data.fixtureNote ? (
            <p className="mono" style={{ fontSize: 12, color: "var(--hyp)", margin: 0, lineHeight: 1.5 }}>
              ⚠ {state.data.fixtureNote}
            </p>
          ) : (
            <SourceStatus sources={state.data.sources} warnings={state.data.warnings} />
          )}

          <AssessmentCard assessment={state.data.report.assessment} />
          <ReportView report={state.data.report} />
          <ExportBar report={state.data.report} sources={state.data.sources} warnings={state.data.warnings} />
          <IcebergCta />
        </div>
      ) : null}
    </main>
  );
}
