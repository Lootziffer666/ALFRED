// plan §36 — Unveränderliches Audit-Log: jeder ausgeführte UND jeder verweigerte PlannedWrite.

import type { AlfretStore } from "../store/types.js";
import type { PlannedWrite } from "./jobs/types.js";
import type { ScopeDecision } from "../scope.js";

export type AuditOutcome = "executed" | "denied" | "dry-run" | "budget-exceeded";

export interface AuditEntry {
  id: string;
  repository: string;
  jobId: string;
  tickId: string;
  write: PlannedWrite;
  outcome: AuditOutcome;
  reason?: string;
  scopeDecision?: ScopeDecision;
  occurredAt: string;
}

function auditEntryId(repository: string, tickId: string, index: number): string {
  return `audit:${repository}@${tickId}:${index}`;
}

export async function recordAudit(
  store: AlfretStore,
  entry: Omit<AuditEntry, "id">,
  index: number,
): Promise<AuditEntry> {
  const full: AuditEntry = {
    id: auditEntryId(entry.repository, entry.tickId, index),
    ...entry,
  };

  // event_store ist append-only: kein update(), kein delete() für "daemon-audit".
  await store.appendEvent({
    kind: "daemon-audit",
    id: full.id,
    payload: full,
    occurredAt: full.occurredAt,
  });

  return full;
}

export async function auditHistory(
  store: AlfretStore,
  repository: string,
  limit = 200,
): Promise<AuditEntry[]> {
  const events = await store.listEvents({
    kind: "daemon-audit",
    repository,
    limit,
  });
  return events.map((e) => e.payload as AuditEntry);
}
