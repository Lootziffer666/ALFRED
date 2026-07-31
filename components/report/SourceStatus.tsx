"use client";

import { AvailabilityBadge } from "@/components/AvailabilityBadge";
import type { SignalSource } from "@/lib/report/signals";

/**
 * What the report could and could not read. A slot that stayed empty says why,
 * so a thin report is visibly a thin *source*, not a quiet repository.
 */
export function SourceStatus({ sources, warnings }: { sources: SignalSource[]; warnings: string[] }) {
  return (
    <section className="card" style={{ padding: 16 }} aria-labelledby="sources">
      <h2
        id="sources"
        className="mono"
        style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--brass)", margin: "0 0 10px" }}
      >
        Quellenlage
      </h2>

      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
        {sources.map((s) => (
          <li key={s.slot} style={{ display: "grid", gap: 4 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--paper)" }}>{s.label}</span>
              <AvailabilityBadge status={s.status} />
              {s.status === "loaded" ? (
                <span className="mono" style={{ fontSize: 11, color: "var(--mut)" }}>{s.chars} Zeichen</span>
              ) : null}
            </div>
            {s.paths.length > 0 ? (
              <div className="mono" style={{ fontSize: 11, color: "var(--paper-dim)" }}>{s.paths.join(" · ")}</div>
            ) : null}
            {s.reason ? (
              <div style={{ fontSize: 12, color: "var(--mut)", lineHeight: 1.5 }}>{s.reason}</div>
            ) : null}
          </li>
        ))}
      </ul>

      {warnings.length > 0 ? (
        <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "grid", gap: 6 }}>
          {warnings.map((w) => (
            <li key={w} className="mono" style={{ fontSize: 11.5, color: "var(--hyp)", lineHeight: 1.5 }}>
              ⚠ {w}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
