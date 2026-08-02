// Health-Persistenz — Stage 0, Phase 2.
// Entity-Wrapper um Heartbeat.
// id = `${agentId}::${taskId}::${timestamp}` — zeitlich sortierbar.

import type { AlfretStore } from "../store/types.js";
import type { Heartbeat } from "./types.js";

export interface StoredHeartbeat extends Heartbeat {
  kind: "heartbeat";
  id: string; // `${agentId}::${taskId}::${timestamp}`
}

function heartbeatId(hb: Heartbeat): string {
  return `${hb.agentId}::${hb.taskId}::${hb.timestamp}`;
}

export async function saveHeartbeat(
  store: AlfretStore,
  heartbeat: Heartbeat,
): Promise<void> {
  const entity: StoredHeartbeat = {
    ...heartbeat,
    kind: "heartbeat",
    id: heartbeatId(heartbeat),
  };
  await store.put(entity);
}

export async function listHeartbeats(
  store: AlfretStore,
  agentId?: string,
): Promise<Heartbeat[]> {
  const all = await store.list<StoredHeartbeat>("heartbeat");
  const filtered = agentId ? all.filter((e) => e.agentId === agentId) : all;
  // Chronologisch sortiert — neueste zuletzt
  filtered.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return filtered.map(({ kind: _k, id: _i, ...hb }) => hb as Heartbeat);
}

export async function getLatestHeartbeat(
  store: AlfretStore,
  agentId: string,
  taskId: string,
): Promise<Heartbeat | undefined> {
  const all = await store.list<StoredHeartbeat>("heartbeat");
  const relevant = all
    .filter((e) => e.agentId === agentId && e.taskId === taskId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // neueste zuerst
  if (relevant.length === 0) return undefined;
  const { kind: _k, id: _i, ...hb } = relevant[0];
  return hb as Heartbeat;
}
