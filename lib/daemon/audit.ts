// plan §36 — Unveränderliches Audit-Log: jeder ausgeführte UND jeder verweigerte PlannedWrite.

import type { AlfretStore, Entity } from "../store/types";
import type { PlannedWrite } from "./jobs/types";
import type { ScopeDecision } from "../scope";

export type AuditOutcome = "executed" | "denied" | "dry-run" | "budget-exceeded";

export interface AuditEntry extends Entity {
  kind: "daemon-audit";
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
  entry: Omit<AuditEntry, "id" | "kind">,
  index: number,
): Promise<AuditEntry> {
  const full: AuditEntry = {
    kind: "daemon-audit",
    id: auditEntryId(entry.repository, entry.tickId, index),
    ...entry,
  };

  // Store ist append-only: put() speichert immer, overwrite ist okay für Versioning
  await store.put(full);

  return full;
}

export async function auditHistory(
  store: AlfretStore,
  repository: string,
  limit = 200,
): Promise<AuditEntry[]> {
  const entries = await store.list<AuditEntry>("daemon-audit");
  return entries
    .filter((e) => e.repository === repository)
    .slice(-limit);
}
