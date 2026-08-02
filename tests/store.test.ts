// Stage 0 — Round-Trip-Tests für alle vier neuen Persistenz-Module.
// Ersetzt den früheren describe.skip-Block gegen eine nie genutzte Store-Klassen-API.

import { describe, it, expect, beforeEach } from "vitest";
import { MemoryStore } from "../lib/store/memory.js";
import { saveOrder, getOrder, listOrders } from "../lib/hermes/persistence.js";
import {
  saveSession,
  getSession,
  listSessions,
} from "../lib/hermes/persistence.js";
import { saveCueReport, getCueReport, listCueReports } from "../lib/cue/persistence.js";
import {
  saveHeartbeat,
  getLatestHeartbeat,
  listHeartbeats,
} from "../lib/health/persistence.js";
import type { HermesOrder, HermesSession } from "../lib/hermes/types.js";
import type { CueReport } from "../lib/cue/types.js";
import type { Heartbeat } from "../lib/health/types.js";

// Minimal stubs — nur die Felder, die die Persistenz-Layer tatsächlich liest.
function makeOrder(
  id: string,
  state: HermesOrder["state"] = "pending",
): HermesOrder {
  return {
    orderId: id,
    planId: "plan-1",
    plan: {} as never,
    state,
    sessionId: null,
    attempts: 0,
    maxRetries: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    failureReason: null,
  };
}

function makeSession(
  id: string,
  phase: HermesSession["phase"] = "idle",
): HermesSession {
  return {
    sessionId: id,
    agentId: "agent-1",
    taskId: "task-1",
    planId: "plan-1",
    nodeId: "node-1",
    phase,
    headSha: null,
    worktree: null,
    leaseExpiresAt: null,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    terminatedAt: null,
  };
}

function makeReport(id: string, taskId = "task-1"): CueReport {
  return {
    reportId: id,
    taskId,
    planId: "plan-1",
    overall: "passed",
    checks: [],
    blocksRelease: false,
    createdAt: new Date().toISOString(),
  };
}

function makeHeartbeat(agentId: string, taskId: string, ts?: string): Heartbeat {
  return {
    agentId,
    taskId,
    sessionId: "sess-1",
    phase: "executing",
    headSha: null,
    lastCheckpoint: null,
    lastCommand: null,
    exitCode: null,
    lastEvidence: null,
    model: null,
    provider: null,
    worktree: null,
    lease: null,
    blocker: null,
    status: "healthy",
    timestamp: ts ?? new Date().toISOString(),
  };
}

describe("Hermes Orders Round-Trip", () => {
  let store: MemoryStore;
  beforeEach(() => {
    store = new MemoryStore();
  });

  it("speichert und liest einen Order", async () => {
    const order = makeOrder("ord-1");
    await saveOrder(store, order);
    const loaded = await getOrder(store, "ord-1");
    expect(loaded?.orderId).toBe("ord-1");
    expect(loaded?.state).toBe("pending");
  });

  it("filtert Orders nach State", async () => {
    await saveOrder(store, makeOrder("ord-a", "pending"));
    await saveOrder(store, makeOrder("ord-b", "completed"));
    const pending = await listOrders(store, "pending");
    expect(pending).toHaveLength(1);
    expect(pending[0].orderId).toBe("ord-a");
  });

  it("gibt undefined zurück für unbekannte Order", async () => {
    expect(await getOrder(store, "nope")).toBeUndefined();
  });
});

describe("Hermes Sessions Round-Trip", () => {
  let store: MemoryStore;
  beforeEach(() => {
    store = new MemoryStore();
  });

  it("speichert und liest eine Session", async () => {
    await saveSession(store, makeSession("sess-1"));
    const loaded = await getSession(store, "sess-1");
    expect(loaded?.sessionId).toBe("sess-1");
  });

  it("filtert Sessions nach Phase", async () => {
    await saveSession(store, makeSession("s1", "idle"));
    await saveSession(store, makeSession("s2", "executing"));
    const executing = await listSessions(store, "executing");
    expect(executing).toHaveLength(1);
    expect(executing[0].sessionId).toBe("s2");
  });
});

describe("CUE Reports Round-Trip", () => {
  let store: MemoryStore;
  beforeEach(() => {
    store = new MemoryStore();
  });

  it("speichert und liest einen Report", async () => {
    await saveCueReport(store, makeReport("rep-1"));
    const loaded = await getCueReport(store, "rep-1");
    expect(loaded?.reportId).toBe("rep-1");
    expect(loaded?.overall).toBe("passed");
  });

  it("filtert Reports nach taskId", async () => {
    await saveCueReport(store, makeReport("r1", "task-A"));
    await saveCueReport(store, makeReport("r2", "task-B"));
    const forA = await listCueReports(store, "task-A");
    expect(forA).toHaveLength(1);
    expect(forA[0].reportId).toBe("r1");
  });
});

describe("Heartbeat Round-Trip", () => {
  let store: MemoryStore;
  beforeEach(() => {
    store = new MemoryStore();
  });

  it("speichert und findet den neuesten Heartbeat", async () => {
    await saveHeartbeat(store, makeHeartbeat("ag-1", "t-1", "2026-08-01T10:00:00Z"));
    await saveHeartbeat(store, makeHeartbeat("ag-1", "t-1", "2026-08-01T11:00:00Z"));
    const latest = await getLatestHeartbeat(store, "ag-1", "t-1");
    expect(latest?.timestamp).toBe("2026-08-01T11:00:00Z");
  });

  it("gibt undefined zurück wenn kein Heartbeat vorhanden", async () => {
    expect(await getLatestHeartbeat(store, "nobody", "task-x")).toBeUndefined();
  });

  it("filtert listHeartbeats nach agentId", async () => {
    await saveHeartbeat(store, makeHeartbeat("ag-A", "t-1"));
    await saveHeartbeat(store, makeHeartbeat("ag-B", "t-2"));
    const forA = await listHeartbeats(store, "ag-A");
    expect(forA).toHaveLength(1);
    expect(forA[0].agentId).toBe("ag-A");
  });
});
