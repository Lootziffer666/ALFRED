import type { NodeDeclaration, NodeObservation } from "../schema/homelab";
import type { PlanningResult } from "./planner";
import { reconcileHardware } from "./discovery";
import type { PlannerNode } from "./planner";

/**
 * Plan export. What leaves the room is the plan and the reasons behind it —
 * including what could not be placed and what was never measured.
 */

export const HOMELAB_PLAN_VERSION = 1;

export interface PlanExportInput {
  nodes: PlannerNode[];
  planning: PlanningResult;
  exportedAt?: string;
}

export function planToJson({ nodes, planning, exportedAt }: PlanExportInput): string {
  return JSON.stringify(
    {
      version: HOMELAB_PLAN_VERSION,
      exportedAt: exportedAt ?? new Date().toISOString(),
      nodes: nodes.map((n) => ({
        declaration: n.declaration,
        observation: n.observation ?? null,
        reconciliation: reconcileHardware(n.declaration, n.observation),
      })),
      proposals: planning.proposals,
      unplaced: planning.unplaced,
    },
    null,
    2,
  );
}

function nodeLine(declaration: NodeDeclaration, observation?: NodeObservation): string {
  const measured = observation ? "gemessen" : "nur deklariert";
  return `- **${declaration.name}** (${declaration.id}) — ${declaration.kind}, ${declaration.os}, ${declaration.trust}, ${declaration.availability}, ${measured}`;
}

export function planToMarkdown({ nodes, planning, exportedAt }: PlanExportInput): string {
  const out: string[] = [];

  out.push("# ALFRET · Raum IX — Plan");
  out.push("");
  out.push(`Erzeugt ${exportedAt ?? new Date().toISOString()}. Nichts davon wurde ausgeführt.`);
  out.push("");

  out.push("## Geräte");
  out.push("");
  if (nodes.length === 0) out.push("_Keine._");
  for (const node of nodes) out.push(nodeLine(node.declaration, node.observation));
  out.push("");

  out.push("## Hardware: behauptet gegen gemessen");
  out.push("");
  for (const node of nodes) {
    out.push(`### ${node.declaration.name}`);
    out.push("");
    out.push("| Feld | Behauptet | Gemessen | Status |");
    out.push("| --- | --- | --- | --- |");
    for (const row of reconcileHardware(node.declaration, node.observation)) {
      out.push(`| ${row.field} | ${row.declared ?? "—"} | ${row.observed ?? "—"} | ${row.truth} |`);
    }
    out.push("");
  }

  out.push("## Platzierungen");
  out.push("");
  if (planning.proposals.length === 0) out.push("_Keine._");
  for (const p of planning.proposals) {
    out.push(`### ${p.task} → ${p.nodeId}`);
    out.push("");
    out.push(`- Runtime: ${p.runtime} / ${p.delivery}, Residency ${p.residency}`);
    out.push(`- Modell: ${p.modelId ?? "—"}`);
    out.push(`- Fit: **${p.fit}**`);
    if (p.memory) {
      out.push(
        `- Speicher: min ${p.memory.minimumGb} / erwartet ${p.memory.expectedGb} / max ${p.memory.maximumGb} GB (${p.memory.confidence})`,
      );
      for (const b of p.memory.breakdown) out.push(`  - ${b.label}: ${b.gb} GB`);
    }
    if (p.fallbackNodeIds.length) out.push(`- Fallback: ${p.fallbackNodeIds.join(", ")}`);
    for (const r of p.rationale) out.push(`- ${r}`);
    for (const w of p.warnings) out.push(`- ⚠ ${w}`);
    out.push("");
    out.push("Erforderliche Prüfungen:");
    for (const c of p.checks) out.push(`- [ ] ${c.description}`);
    out.push("");
  }

  if (planning.unplaced.length) {
    out.push("## Nicht platziert");
    out.push("");
    for (const u of planning.unplaced) {
      out.push(`### ${u.task}`);
      out.push("");
      for (const r of u.reasons) out.push(`- ⊘ ${r}`);
      out.push("");
    }
  }

  out.push("## Was dieser Plan nicht behauptet");
  out.push("");
  out.push("- Nichts wurde installiert, gestartet oder geprüft.");
  out.push("- Ein `not-proven`-Fit bedeutet, dass die Hardware nie gemessen wurde.");
  out.push("- Ein ungemessenes Modell ist ein Vorschlag, keine Auswahl.");
  out.push("");

  return out.join("\n");
}
