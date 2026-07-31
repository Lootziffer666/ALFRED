"use client";

import { useEffect } from "react";
import type { Evidence } from "@/lib/atoms/types";

export interface EvidenceSelection {
  atomId: string;
  text: string;
  evidence: Evidence[];
}

export function EvidenceDrawer({
  selection,
  onClose,
}: {
  selection: EvidenceSelection | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, onClose]);

  if (!selection) return null;

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(11,13,18,.6)", zIndex: 40 }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Evidence für ${selection.atomId}`}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(440px, 100vw)",
          background: "var(--ink2)",
          borderLeft: "1px solid var(--line)",
          zIndex: 41,
          overflowY: "auto",
          padding: "20px 18px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <span className="mono" style={{ fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: "var(--brass)" }}>
            Evidence · {selection.atomId}
          </span>
          <button type="button" onClick={onClose} aria-label="Evidence schließen">
            ✕
          </button>
        </div>

        <p className="serif" style={{ marginTop: 14, color: "var(--paper)", lineHeight: 1.6 }}>
          {selection.text}
        </p>

        <p className="mono" style={{ fontSize: 11, color: "var(--mut)", marginTop: 18, marginBottom: 8 }}>
          Worauf dieser Satz beruht
        </p>

        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
          {selection.evidence.map((e, i) => (
            <li key={`${e.k}-${i}`} className="card-inset" style={{ padding: 12 }}>
              <div className="mono" style={{ fontSize: 11, color: "var(--brass-l)" }}>{e.k}</div>
              <div style={{ color: "var(--paper)", marginTop: 4, fontSize: 14, lineHeight: 1.5 }}>{e.v}</div>
            </li>
          ))}
        </ul>

        <p style={{ color: "var(--mut)", fontSize: 12, marginTop: 18, lineHeight: 1.55 }}>
          Ohne diese Belege stünde der Satz nicht im Bericht. ALFRET erfindet keine Befunde und
          markiert Unbelegtes als unbelegt.
        </p>
      </aside>
    </>
  );
}
