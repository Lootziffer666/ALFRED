// Stage 3 — Baut den Suchindex aus echten Store-Daten.
// Liest finding-capsule + daemon-audit Entities, mapped auf SearchResult.

import type { AlfretStore } from "../store/types.js";
import type { FindingCapsule } from "../findings/capsule.js";
import type { AuditEntry } from "../daemon/audit.js";

export interface SearchResult {
  id: string;
  kind: "finding" | "audit";
  repository: string;
  title: string;
  detail: string;
  severity?: string;
  path?: string;
  observedAt: string;
  tags: string[];
}

export async function buildSearchIndex(
  store: AlfretStore,
  repository?: string,
): Promise<SearchResult[]> {
  const [capsules, audits] = await Promise.all([
    store.list<FindingCapsule & { kind: "finding-capsule" }>("finding-capsule"),
    store.list<AuditEntry>("daemon-audit"),
  ]);

  const results: SearchResult[] = [];

  for (const cap of capsules) {
    if (repository && cap.repository !== repository) continue;

    results.push({
      id: cap.id,
      kind: "finding",
      repository: cap.repository,
      title: cap.finding.kind,
      detail: cap.finding.detail ?? "",
      severity: cap.finding.severity,
      path: cap.finding.path,
      observedAt: cap.observedAt,
      tags: [cap.finding.kind, cap.finding.severity ?? "info", cap.source],
    });
  }

  for (const audit of audits) {
    if (repository && audit.repository !== repository) continue;

    results.push({
      id: audit.id,
      kind: "audit",
      repository: audit.repository,
      title: `${audit.write.kind} — ${audit.outcome}`,
      detail: audit.reason ?? audit.write.reason,
      observedAt: audit.occurredAt,
      tags: [audit.outcome, audit.write.kind],
    });
  }

  return results;
}
