// Stage 7 — Butler-Post: Aggregation aller offenen Aufmerksamkeitspunkte.
// Keine neue Erkennungslogik — nur Zusammenführung aus bereits vorhandenen Daten.

import type { AlfretStore } from "../store/types.js";
import { listPendingWrites } from "../daemon/writes-log.js";
import { loadDecisions } from "../corpus/persistence.js";

export type AttentionKind =
  | "pending-write"
  | "unresolved-finding"
  | "health-alert"
  | "refinery-escalation";

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  repository: string;
  title: string;
  detail: string;
  severity: "info" | "warning" | "error";
  createdAt: string;
  actionUrl?: string;
}

export async function collectAttentionItems(
  store: AlfretStore,
  repository?: string,
): Promise<AttentionItem[]> {
  const items: AttentionItem[] = [];

  // 1. Offene Writes
  const pendingWrites = await listPendingWrites(store, repository);
  for (const pw of pendingWrites) {
    items.push({
      id: pw.id,
      kind: "pending-write",
      repository: pw.write.repository,
      title: `${pw.write.kind} wartet auf Freigabe`,
      detail: pw.write.reason,
      severity: "warning",
      createdAt: pw.createdAt,
      actionUrl: `/api/repair/${pw.id}`,
    });
  }

  // 2. Findings ohne autoFix (error/warning) — direkt aus finding-capsule
  const allCapsules = await store.list<{
    kind: "finding-capsule";
    id: string;
    repository: string;
    observedAt: string;
    finding: { kind: string; severity?: string; detail?: string; autoFixable?: boolean; path?: string };
  }>("finding-capsule");

  for (const cap of allCapsules) {
    if (repository && cap.repository !== repository) continue;
    if (cap.finding.autoFixable) continue;
    if (cap.finding.severity !== "error" && cap.finding.severity !== "warning") continue;

    items.push({
      id: cap.id,
      kind: "unresolved-finding",
      repository: cap.repository,
      title: `${cap.finding.kind} — ${cap.finding.path ?? "?"}`,
      detail: cap.finding.detail ?? "",
      severity: cap.finding.severity as "warning" | "error",
      createdAt: cap.observedAt,
      actionUrl: `/api/evidence/${cap.id}`,
    });
  }

  // Neueste zuerst
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return items;
}
