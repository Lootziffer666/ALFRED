// Stage 1 — Persistenz für PlannedWrites, die aus Job-Runs stammen.
// Status-Lifecycle: pending-approval → executed | denied | dry-run

import type { AlfretStore, Entity } from "../store/types.js";
import type { PlannedWrite } from "./jobs/types.js";

export type StoredWriteStatus =
  | "pending-approval"
  | "executed"
  | "denied"
  | "dry-run";

export interface StoredPlannedWrite extends Entity {
  kind: "planned-write";
  id: string; // `${repository}@${tickId}:${jobName}:${writeIndex}`
  tickId: string;
  jobName: string;
  status: StoredWriteStatus;
  write: PlannedWrite;
  createdAt: string;
  resolvedAt: string | null;
}

export function plannedWriteId(
  repository: string,
  tickId: string,
  jobName: string,
  index: number,
): string {
  return `${repository}@${tickId}:${jobName}:${index}`;
}

export async function logPlannedWrite(
  store: AlfretStore,
  opts: {
    write: PlannedWrite;
    tickId: string;
    jobName: string;
    index: number;
    status: StoredWriteStatus;
  },
): Promise<StoredPlannedWrite> {
  const entity: StoredPlannedWrite = {
    kind: "planned-write",
    id: plannedWriteId(opts.write.repository, opts.tickId, opts.jobName, opts.index),
    tickId: opts.tickId,
    jobName: opts.jobName,
    status: opts.status,
    write: opts.write,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };

  await store.put(entity);
  return entity;
}

export async function listPendingWrites(
  store: AlfretStore,
  repository?: string,
): Promise<StoredPlannedWrite[]> {
  const all = await store.list<StoredPlannedWrite>("planned-write");
  return all.filter(
    (e) =>
      e.status === "pending-approval" &&
      (repository === undefined || e.write.repository === repository),
  );
}

export async function resolveWrite(
  store: AlfretStore,
  id: string,
  status: Exclude<StoredWriteStatus, "pending-approval">,
): Promise<void> {
  const existing = await store.get<StoredPlannedWrite>("planned-write", id);
  if (!existing) return;

  const updated: StoredPlannedWrite = { ...existing, status, resolvedAt: new Date().toISOString() };
  await store.put(updated);
}
