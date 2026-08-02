// Hermes-Persistenz — Stage 0, Phase 2.
// Entity-Wrapper um HermesOrder und HermesSession.
// Folgt exakt dem Muster von lib/daemon/jobs/job-state.ts.

import type { AlfretStore } from "../store/types.js";
import type { HermesOrder, HermesSession } from "./types.js";

// ── Entity-Wrapper-Typen ──────────────────────────────────────────────────

export interface StoredHermesOrder extends HermesOrder {
  kind: "hermes-order";
  id: string; // = orderId
}

export interface StoredHermesSession extends HermesSession {
  kind: "hermes-session";
  id: string; // = sessionId
}

// ── Orders ────────────────────────────────────────────────────────────────

export async function saveOrder(
  store: AlfretStore,
  order: HermesOrder,
): Promise<void> {
  const entity: StoredHermesOrder = {
    ...order,
    kind: "hermes-order",
    id: order.orderId,
  };
  await store.put(entity);
}

export async function getOrder(
  store: AlfretStore,
  orderId: string,
): Promise<HermesOrder | undefined> {
  const entity = await store.get<StoredHermesOrder>("hermes-order", orderId);
  if (!entity) return undefined;
  const { kind: _k, id: _i, ...order } = entity;
  return order as HermesOrder;
}

export async function listOrders(
  store: AlfretStore,
  state?: HermesOrder["state"],
): Promise<HermesOrder[]> {
  const all = await store.list<StoredHermesOrder>("hermes-order");
  const filtered = state ? all.filter((e) => e.state === state) : all;
  return filtered.map(({ kind: _k, id: _i, ...o }) => o as HermesOrder);
}

// ── Sessions ──────────────────────────────────────────────────────────────

export async function saveSession(
  store: AlfretStore,
  session: HermesSession,
): Promise<void> {
  const entity: StoredHermesSession = {
    ...session,
    kind: "hermes-session",
    id: session.sessionId,
  };
  await store.put(entity);
}

export async function getSession(
  store: AlfretStore,
  sessionId: string,
): Promise<HermesSession | undefined> {
  const entity = await store.get<StoredHermesSession>(
    "hermes-session",
    sessionId,
  );
  if (!entity) return undefined;
  const { kind: _k, id: _i, ...session } = entity;
  return session as HermesSession;
}

export async function listSessions(
  store: AlfretStore,
  phase?: HermesSession["phase"],
): Promise<HermesSession[]> {
  const all = await store.list<StoredHermesSession>("hermes-session");
  const filtered = phase ? all.filter((e) => e.phase === phase) : all;
  return filtered.map(({ kind: _k, id: _i, ...s }) => s as HermesSession);
}
