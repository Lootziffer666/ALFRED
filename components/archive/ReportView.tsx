"use client";

import type { RenderedPhase } from "@/lib/atoms/compose";

const PHASE_NUMERALS = ["I", "II", "III", "IV", "V"];

const CLS_STYLE: Record<string, React.CSSProperties> = {
  "cue-ok": { borderLeft: "2px solid var(--ok)", paddingLeft: 12 },
  "cue-hyp": { borderLeft: "2px dashed var(--hyp)", paddingLeft: 12, color: "#c4c0b6" },
  "cue-bad": { borderLeft: "2px solid var(--zinnober)", paddingLeft: 12, background: "rgba(214,64,44,.05)", borderRadius: "0 6px 6px 0" },
  "cue-notag": { borderLeft: "2px dashed var(--brass-d)", paddingLeft: 12, color: "#cfc8b8" },
};

const TAG_STYLE: Record<string, React.CSSProperties> = {
  ok: { background: "rgba(127,174,106,.16)", color: "var(--ok)", border: "1px solid #2a3a22" },
  hyp: { background: "rgba(124,130,144,.16)", color: "var(--hyp)", border: "1px solid #2a2e36" },
  bad: { background: "rgba(214,64,44,.16)", color: "#ff9a8a", border: "1px solid var(--zinnober-d)" },
};

export function ReportView({ phases, mode }: { phases: RenderedPhase[] | null; mode: "fallback" | "ki" | null }) {
  if (!phases) {
    return (
      <p className="serif" style={{ color: "var(--mut)", fontStyle: "italic" }}>
        Noch kein Bericht gesetzt. &bdquo;Pressen &amp; setzen&ldquo; oder &bdquo;Mit KI setzen&ldquo; klicken.
      </p>
    );
  }

  return (
    <div>
      <div
        className="mono"
        style={{
          fontSize: 10.5,
          padding: "8px 11px",
          borderRadius: 8,
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 9,
          border: mode === "ki" ? "1px solid var(--bordeaux-d)" : "1px dashed var(--brass-d)",
          background: mode === "ki" ? "rgba(156,47,68,.08)" : "rgba(183,138,62,.06)",
          color: mode === "ki" ? "#e7a9b6" : "var(--brass-l)",
        }}
      >
        <span className="dot" style={{ background: mode === "ki" ? "var(--bordeaux)" : "var(--brass-l)" }} />
        {mode === "ki" ? "KI gesetzt · CUE (Raum VII) hat jeden Satz auditiert." : "Fallback-Setzer · deterministisch, jeder Satz belegt."}
      </div>

      {phases.map((ph) => (
        <div key={ph.index} style={{ marginBottom: 22 }}>
          <div
            className="mono"
            style={{
              fontSize: 10,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "var(--brass)",
              borderBottom: "1px dashed var(--line)",
              paddingBottom: 5,
              marginBottom: 11,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>§ {PHASE_NUMERALS[ph.index]} · {ph.title}</span>
            <span style={{ color: "var(--zinnober)" }}>{ph.levelName}</span>
          </div>

          {ph.banner && (
            <div
              className="mono"
              style={{
                fontSize: 10,
                color: "var(--paper-dim)",
                border: "1px solid var(--line)",
                borderLeft: "3px solid var(--ok)",
                borderRadius: "0 8px 8px 0",
                background: "rgba(127,174,106,.05)",
                padding: "8px 11px",
                marginBottom: 14,
                lineHeight: 1.6,
              }}
            >
              {ph.banner}
            </div>
          )}

          {ph.empty && (
            <p className="serif" style={{ color: "var(--mut)", fontStyle: "italic" }}>
              Keine belegten Signale für diese Phase – Alfret schweigt hier, statt zu raten.
            </p>
          )}

          {ph.paragraphs.map((p, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <p className="serif" style={{ fontSize: 16.5, lineHeight: 1.62, margin: 0, color: "var(--paper)", ...CLS_STYLE[p.cls] }}>
                {p.text}{" "}
                {p.tags.map((t, ti) => (
                  <span
                    key={ti}
                    className="mono"
                    style={{ fontSize: 8.5, verticalAlign: "super", padding: "1px 5px", borderRadius: 4, marginLeft: 2, ...TAG_STYLE[t.kind] }}
                  >
                    {t.kind === "bad" ? "⚠" : t.kind === "ok" ? "✓" : "?"} {t.label}
                  </span>
                ))}
              </p>
              {p.evidence.length > 0 && (
                <div className="mono" style={{ fontSize: 9, color: "var(--mut)", margin: "-4px 0 0 14px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {p.evidence.map((e, ei) => (
                    <span key={ei}>
                      <span style={{ color: "var(--brass)" }}>{e.k}:</span> {e.v}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {ph.warn && (
            <div
              style={{
                marginTop: 8,
                border: "2px solid var(--zinnober)",
                borderRadius: 10,
                padding: "14px 16px",
                background: "rgba(214,64,44,.06)",
                fontFamily: "var(--font-serif)",
                fontStyle: "italic",
                fontSize: 17,
                color: "#f3cdbf",
                lineHeight: 1.4,
                position: "relative",
              }}
            >
              {ph.warn}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
