import { describe, it, expect, beforeEach } from "vitest";
import { MemoryAlfretStore, SqliteAlfretStore } from "@/lib/store";
import { createOrder, createSession } from "@/lib/hermes";
import { makeEvent } from "@/lib/hermes/events";
import { createHandoff } from "@/lib/hermes/handoffs";
import { buildCueReport, makeStaticCueCheck } from "@/lib/cue";
import type { Heartbeat, HealthStatus } from "@/lib/health/types";

function fakePlan(planId = "plan-1") {
  return {
    planId,
    nodeId: "workstation",
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    nonce: `nonce-${Math.random()}`,
    steps: [{ adapterId: "probe", adapterVersion: "1.0.0", kind: "probe-node", params: {} }],
    artifactHashes: {},
    signerKeyId: "key-1",
    signature: "sig-placeholder",
  };
}

function fakeHeartbeat(agentId = "agent-1", taskId = "task-1"): Heartbeat {
  return {
    agentId,
    taskId,
    sessionId: "session-1",
    phase: "executing",
    headSha: "abc123",
    lastCheckpoint: "checkpoint-1",
    lastCommand: "git push",
    exitCode: 0,
    lastEvidence: "pushed to remote",
    model: "claude-3",
    provider: "anthropic",
    worktree: "worktrees/task-1",
    lease: "2h",
    blocker: null,
    status: "healthy" as HealthStatus,
    timestamp: new Date().toISOString(),
  };
}

describe.each([
  { name: "MemoryAlfretStore", create: () => new MemoryAlfretStore() },
  { name: "SqliteAlfretStore", create: () => new SqliteAlfretStore() },
])("$name", ({ create }) => {
  let store: ReturnType<typeof create>;

  beforeEach(() => {
    store = create();
  });

  // ── Orders ──────────────────────────────────────────────────────────────

  describe("Orders", () => {
    it("stores and retrieves an order", async () => {
      const order = createOrder(fakePlan("plan-x"));
      await store.setOrder(order);
      const retrieved = await store.getOrder(order.orderId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.planId).toBe("plan-x");
    });

    it("lists all orders", async () => {
      const o1 = createOrder(fakePlan("plan-1"));
      const o2 = createOrder(fakePlan("plan-2"));
      await store.setOrder(o1);
      await store.setOrder(o2);
      const all = await store.listOrders();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });

    it("filters orders by state", async () => {
      const order = createOrder(fakePlan("plan-f"));
      await store.setOrder(order);
      const pending = await store.listOrders("pending");
      expect(pending.some((o) => o.orderId === order.orderId)).toBe(true);
    });
  });

  // ── Sessions ────────────────────────────────────────────────────────────

  describe("Sessions", () => {
    it("stores and retrieves a session", async () => {
      const session = createSession("a1", "t1", "p1", "node-1");
      await store.setSession(session);
      const retrieved = await store.getSession(session.sessionId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.taskId).toBe("t1");
    });

    it("lists all sessions", async () => {
      const s1 = createSession("a1", "t1", "p1", "node-1");
      const s2 = createSession("a2", "t2", "p2", "node-2");
      await store.setSession(s1);
      await store.setSession(s2);
      const all = await store.listSessions();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Events ──────────────────────────────────────────────────────────────

  describe("Events", () => {
    it("appends and retrieves events", async () => {
      const orderId = "order-1";
      const event1 = makeEvent("order-created", orderId, { detail: "test1" });
      const event2 = makeEvent("order-dispatched", orderId, { detail: "test2" });
      await store.appendEvent(event1);
      await store.appendEvent(event2);
      const events = await store.getEvents(orderId);
      expect(events.length).toBeGreaterThanOrEqual(2);
    });

    it("preserves event order", async () => {
      const orderId = "order-x";
      const event1 = makeEvent("order-created", orderId, {});
      const event2 = makeEvent("order-dispatched", orderId, {});
      await store.appendEvent(event1);
      await store.appendEvent(event2);
      const events = await store.getEvents(orderId);
      const indices = [
        events.findIndex((e) => e.eventId === event1.eventId),
        events.findIndex((e) => e.eventId === event2.eventId),
      ];
      expect(indices[0]).toBeLessThan(indices[1]);
    });

    it("retrieves all events", async () => {
      const event = makeEvent("order-created", "order-all", {});
      await store.appendEvent(event);
      const all = await store.allEvents();
      expect(all.some((e) => e.eventId === event.eventId)).toBe(true);
    });
  });

  // ── Handoffs ────────────────────────────────────────────────────────────

  describe("Handoffs", () => {
    it("stores and retrieves a handoff", async () => {
      const handoff = createHandoff("a1", "t1", "p1", "sha-abc", "summary", [], [], []);
      await store.setHandoff(handoff);
      const retrieved = await store.getHandoff(handoff.handoffId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.fromAgentId).toBe("a1");
    });

    it("lists handoffs by taskId", async () => {
      const h1 = createHandoff("a1", "t-same", "p1", "sha-1", "s1", [], [], []);
      const h2 = createHandoff("a2", "t-same", "p2", "sha-2", "s2", [], [], []);
      const h3 = createHandoff("a3", "t-other", "p3", "sha-3", "s3", [], [], []);
      await store.setHandoff(h1);
      await store.setHandoff(h2);
      await store.setHandoff(h3);
      const same = await store.listHandoffs("t-same");
      expect(same.length).toBeGreaterThanOrEqual(2);
      expect(same.every((h) => h.taskId === "t-same")).toBe(true);
    });
  });

  // ── Heartbeats ──────────────────────────────────────────────────────────

  describe("Heartbeats", () => {
    it("appends and retrieves heartbeats", async () => {
      const hb1 = fakeHeartbeat("agent-x", "task-x");
      const hb2 = { ...hb1, timestamp: new Date(Date.now() + 1000).toISOString() };
      await store.appendHeartbeat(hb1);
      await store.appendHeartbeat(hb2);
      const hbs = await store.getHeartbeats("agent-x");
      expect(hbs.length).toBeGreaterThanOrEqual(2);
    });

    it("retrieves latest heartbeat by agent and task", async () => {
      const hb1 = fakeHeartbeat("agent-y", "task-y");
      const hb2 = {
        ...hb1,
        status: "degraded" as HealthStatus,
        timestamp: new Date(Date.now() + 5000).toISOString(),
      };
      await store.appendHeartbeat(hb1);
      await store.appendHeartbeat(hb2);
      const latest = await store.getLatestHeartbeat("agent-y", "task-y");
      expect(latest).toBeDefined();
      expect(latest?.status).toBe("degraded");
    });

    it("returns null for missing heartbeat", async () => {
      const latest = await store.getLatestHeartbeat("nonexistent", "nonexistent");
      expect(latest).toBeNull();
    });
  });

  // ── CUE Reports ─────────────────────────────────────────────────────────

  describe("CUE Reports", () => {
    it("stores and retrieves a CUE report", async () => {
      const checks = [
        makeStaticCueCheck("schema-fidelity", "passed", "OK"),
        makeStaticCueCheck("regression", "passed", "OK"),
      ];
      const report = buildCueReport("t-cue", "p-cue", checks);
      await store.setCueReport(report);
      const retrieved = await store.getCueReport(report.reportId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.overall).toBe("passed");
    });

    it("lists CUE reports by planId", async () => {
      const checks = [makeStaticCueCheck("schema-fidelity", "passed", "OK")];
      const r1 = buildCueReport("t1", "p-same", checks);
      const r2 = buildCueReport("t2", "p-same", checks);
      const r3 = buildCueReport("t3", "p-other", checks);
      await store.setCueReport(r1);
      await store.setCueReport(r2);
      await store.setCueReport(r3);
      const same = await store.listCueReports("p-same");
      expect(same.length).toBeGreaterThanOrEqual(2);
      expect(same.every((r) => r.planId === "p-same")).toBe(true);
    });
  });

  // ── Maid Reports ────────────────────────────────────────────────────────

  describe("Maid Reports", () => {
    it("stores and retrieves a Maid report", async () => {
      const report = {
        repository: "org/repo",
        commitSha: "sha-m1",
        findings: [],
        proposals: [],
        classifiedFiles: { "src/main.ts": "active" as const },
        runAt: new Date().toISOString(),
      };
      await store.setMaidReport(report);
      const retrieved = await store.getMaidReport("sha-m1");
      expect(retrieved).toBeDefined();
      expect(retrieved?.repository).toBe("org/repo");
    });

    it("lists all Maid reports", async () => {
      const r1 = {
        repository: "org/repo",
        commitSha: "sha-1",
        findings: [],
        proposals: [],
        classifiedFiles: {},
        runAt: new Date().toISOString(),
      };
      const r2 = { ...r1, commitSha: "sha-2" };
      await store.setMaidReport(r1);
      await store.setMaidReport(r2);
      const all = await store.allMaidReports();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });
  });
});
