"use client";

import type { Atom } from "@/lib/atoms/types";
import type { Mode } from "@/lib/atoms/compose";

export function Winkelhaken({
  atoms,
  mode,
  unusedIds,
  onHover,
  onLeave,
}: {
  atoms: Atom[];
  mode: Mode;
  unusedIds: Set<string>;
  onHover: (e: React.MouseEvent, atom: Atom) => void;
  onLeave: () => void;
}) {
  return (
    <div className="card-inset" style={{ padding: "12px 14px", marginTop: 16, position: "relative" }}>
      <span className="mono" style={{ fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--brass-d)" }}>
        Winkelhaken · gesetzte Atome (Hover = Roh-Signal · blass = von KI nicht verarbeitet)
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
        {atoms.length === 0 && (
          <span className="serif" style={{ color: "var(--mut)", fontStyle: "italic", fontSize: 13 }}>
            Noch keine Atome gesetzt.
          </span>
        )}
        {atoms.map((a) => {
          const unused = unusedIds.has(a.id);
          return (
            <span
              key={a.id}
              onMouseMove={(e) => onHover(e, a)}
              onMouseLeave={onLeave}
              className="mono"
              style={{
                fontSize: 10.5,
                padding: "4px 8px",
                borderRadius: 4,
                color: "#1a140c",
                fontWeight: 600,
                background: a.hyp ? "linear-gradient(180deg,#9aa0ad,#6f7682)" : "linear-gradient(180deg,#d8c39a,#b79a64)",
                border: `1px solid ${a.hyp ? "#565d68" : "#8a6e3e"}`,
                opacity: unused ? 0.45 : 1,
                outline: unused ? "1px dashed var(--mut)" : "none",
                outlineOffset: 1,
                whiteSpace: "nowrap",
                cursor: "default",
              }}
            >
              {a.id.replace(/_/g, " ")}
              {mode === "meta" && a.count ? ` ×${a.count}` : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}
