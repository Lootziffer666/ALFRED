"use client";

import type { ReportAssessment } from "@/lib/report/assessment";

/**
 * The serious reading, kept visually apart from the tone. This is the part
 * that must survive the joke: capabilities, donor fit, and an explicit list of
 * what the report did not judge.
 */
export function AssessmentCard({ assessment }: { assessment: ReportAssessment }) {
  return (
    <section className="card" style={{ padding: 18 }} aria-labelledby="assessment">
      <h2
        id="assessment"
        className="mono"
        style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--brass)", margin: "0 0 8px" }}
      >
        Kurzbewertung
      </h2>

      <p style={{ color: "var(--paper)", margin: "0 0 16px", fontSize: 15, lineHeight: 1.6 }}>{assessment.headline}</p>

      <div className="grid2" style={{ gap: 18 }}>
        <div>
          <h3 className="mono" style={{ fontSize: 11, color: "var(--paper-dim)", margin: "0 0 8px" }}>
            Belegte Fähigkeiten ({assessment.capabilities.length})
          </h3>
          {assessment.capabilities.length === 0 ? (
            <p style={{ color: "var(--mut)", fontSize: 13, margin: 0, fontStyle: "italic" }}>
              Keine — die Befunde beschreiben Eigenheiten, keine Stärken.
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
              {assessment.capabilities.map((c) => (
                <li key={c.atomId}>
                  <span className="mono" style={{ fontSize: 12, color: "var(--ok)" }}>{c.label}</span>
                  <div style={{ color: "var(--paper-dim)", fontSize: 13, lineHeight: 1.5 }}>{c.detail}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mono" style={{ fontSize: 11, color: "var(--paper-dim)", margin: "0 0 8px" }}>
            Donor-Eignung
          </h3>
          <span className="pill" style={{ marginBottom: 8 }}>
            <span className="dot" style={{ background: assessment.donor.role === "unclear" ? "var(--hyp)" : "var(--brass-l)" }} />
            {assessment.donor.label}
          </span>
          <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "grid", gap: 6 }}>
            {assessment.donor.reasons.map((r) => (
              <li key={r} style={{ color: "var(--paper-dim)", fontSize: 13, lineHeight: 1.5 }}>{r}</li>
            ))}
            {assessment.donor.blockers.map((b) => (
              <li key={b} style={{ color: "var(--zinnober)", fontSize: 12.5, lineHeight: 1.5 }}>⊘ {b}</li>
            ))}
          </ul>
        </div>
      </div>

      <h3 className="mono" style={{ fontSize: 11, color: "var(--paper-dim)", margin: "18px 0 8px" }}>
        Nicht beurteilt
      </h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
        {assessment.unknowns.map((u) => (
          <li key={u} style={{ color: "var(--mut)", fontSize: 12.5, lineHeight: 1.5 }}>— {u}</li>
        ))}
      </ul>
    </section>
  );
}
