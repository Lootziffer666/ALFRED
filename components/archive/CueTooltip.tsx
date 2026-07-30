"use client";

import { useCallback, useState } from "react";
import type { Atom } from "@/lib/atoms/types";
import type { Mode } from "@/lib/atoms/compose";

interface TooltipState {
  atom: Atom;
  x: number;
  y: number;
}

export function useCueTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const showCue = useCallback((e: React.MouseEvent, atom: Atom) => {
    setTooltip({ atom, x: Math.min(window.innerWidth - 300, e.clientX + 14), y: Math.min(window.innerHeight - 140, e.clientY + 14) });
  }, []);
  const hideCue = useCallback(() => setTooltip(null), []);

  return { tooltip, showCue, hideCue };
}

export function CueTooltip({ tooltip, mode }: { tooltip: TooltipState | null; mode: Mode }) {
  if (!tooltip) return null;
  const { atom, x, y } = tooltip;
  return (
    <div
      className="card-inset"
      style={{
        position: "fixed",
        zIndex: 60,
        left: x,
        top: y,
        maxWidth: 300,
        padding: "9px 11px",
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        color: "var(--paper-dim)",
        lineHeight: 1.5,
        pointerEvents: "none",
        borderColor: "var(--brass-d)",
      }}
    >
      <span style={{ color: "var(--brass)", fontWeight: 600, display: "block", marginBottom: 4 }}>
        ATOM · {atom.id}
        {atom.hyp ? " · HYPOTHESE" : ""}
        {mode === "meta" ? ` · ×${atom.count ?? ""} Repos` : ""}
      </span>
      Beleg (SOURCE):
      {atom.evidence.map((ev, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <span style={{ color: "var(--zinnober)", flex: "0 0 auto" }}>{ev.k}:</span>
          <span>{ev.v}</span>
        </div>
      ))}
    </div>
  );
}
