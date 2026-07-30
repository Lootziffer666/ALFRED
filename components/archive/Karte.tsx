"use client";

import { useMemo } from "react";
import type { Atom, AtomCategory } from "@/lib/atoms/types";
import { CATMETA } from "@/lib/atoms/data";
import type { Mode } from "@/lib/atoms/compose";

const ROW_LABELS = ["VERFASSUNG", "KAUSALITÄT", "RECHTSPRECHUNG", "ERKENNTNIS"];
const W = 520;
const ROW_H = 120;
const TOP_PAD = 46;

const RELATIONS: [string, string, AtomCategory][] = [
  ["constitution", "monopoly", "authority"],
  ["monopoly", "marker", "authority"],
  ["constitution", "melderecht", "authority"],
  ["monopoly", "verify", "adjudication"],
  ["verify", "oracle", "adjudication"],
  ["commit_precedent", "pr_tribunal", "adjudication"],
  ["unknown", "semantic", "causality"],
  ["worldlaws", "semantic", "causality"],
  ["realm", "recursive", "epistemic"],
  ["inherit", "verify", "causality"],
  ["single_file", "constitution", "authority"],
  ["pr_tribunal", "unknown", "adjudication"],
];

function atomById(atoms: Atom[], id: string) {
  return atoms.find((a) => a.id === id);
}

export function Karte({
  atoms,
  mode,
  onHover,
  onLeave,
}: {
  atoms: Atom[];
  mode: Mode;
  onHover: (e: React.MouseEvent, atom: Atom) => void;
  onLeave: () => void;
}) {
  const { rects, nodes, edges } = useMemo(() => {
    const rows: Record<number, Atom[]> = { 0: [], 1: [], 2: [], 3: [] };
    atoms.forEach((a) => rows[CATMETA[a.cat].row].push(a));
    const maxCount = Math.max(1, ...atoms.map((a) => a.count ?? 1));

    const rects = Object.keys(rows).map((rk) => {
      const r = Number(rk);
      const y = TOP_PAD + r * ROW_H;
      const color = Object.values(CATMETA).find((c) => c.row === r)!.color;
      return { r, y, color, label: ROW_LABELS[r] };
    });

    const pos: Record<string, { x: number; y: number }> = {};
    const nodes = Object.keys(rows).flatMap((rk) => {
      const r = Number(rk);
      const arr = rows[r];
      const n = arr.length;
      const y = TOP_PAD + r * ROW_H + (ROW_H - 16) / 2 + 6;
      return arr.map((a, i) => {
        const x = n === 1 ? W / 2 : 40 + (W - 80) * (i / (n - 1 || 1));
        pos[a.id] = { x, y };
        const label = a.id.replace(/_/g, " ") + (mode === "meta" ? ` ×${a.count ?? ""}` : "");
        const width = Math.max(58, label.length * 6 + 18);
        const strokeWidth = mode === "meta" ? 1 + ((a.count ?? 1) / maxCount) * 1.6 : 2;
        return { atom: a, x, y, width, strokeWidth, label: label.length > 17 ? `${label.slice(0, 16)}…` : label, color: CATMETA[a.cat].color };
      });
    });

    const edges = RELATIONS.map(([s, t, cat]) => {
      const a = atomById(atoms, s);
      const b = atomById(atoms, t);
      if (!a || !b || !pos[s] || !pos[t]) return null;
      const hyp = a.hyp || b.hyp;
      const color = hyp ? "#7c8290" : CATMETA[cat].color;
      const p0 = pos[s];
      const p1 = pos[t];
      const mx = (p0.x + p1.x) / 2;
      const my = (p0.y + p1.y) / 2 - 18;
      return { d: `M ${p0.x} ${p0.y} Q ${mx} ${my} ${p1.x} ${p1.y}`, color, hyp };
    }).filter((e): e is NonNullable<typeof e> => !!e);

    return { rects, nodes, edges };
  }, [atoms, mode]);

  return (
    <svg viewBox="0 0 520 560" style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <marker id="ah" markerWidth={9} markerHeight={9} refX={7} refY={3} orient="auto">
          <path d="M0,0 L7,3 L0,6 Z" fill="#b78a3e" />
        </marker>
      </defs>
      {rects.map((r) => (
        <g key={r.r}>
          <rect x={10} y={r.y} width={W - 20} height={ROW_H - 16} rx={10} fill="none" stroke={r.color} strokeWidth={1} strokeDasharray="3,5" opacity={0.4} />
          <text x={20} y={r.y + 18} fontFamily="ui-monospace,monospace" fontSize={9} letterSpacing={2} fill={r.color} opacity={0.8}>
            {r.label}
          </text>
        </g>
      ))}
      {edges.map((e, i) => (
        <path key={i} d={e.d} fill="none" stroke={e.color} strokeWidth={1.6} strokeDasharray={e.hyp ? "4,3" : undefined} opacity={0.7} markerEnd="url(#ah)" />
      ))}
      {nodes.map((n) => (
        <g
          key={n.atom.id}
          onMouseMove={(e) => onHover(e, n.atom)}
          onMouseLeave={onLeave}
          style={{ cursor: "default" }}
        >
          <rect
            x={n.x - n.width / 2}
            y={n.y - 15}
            width={n.width}
            height={30}
            rx={6}
            fill="#13161d"
            stroke={n.atom.hyp ? "#7c8290" : n.color}
            strokeWidth={n.strokeWidth}
            strokeDasharray={n.atom.hyp ? "4,3" : undefined}
          />
          <text x={n.x} y={n.y + 4} textAnchor="middle" fontFamily="ui-monospace,monospace" fontSize={9} fill={n.atom.hyp ? "#7c8290" : "#e9e2d0"}>
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
