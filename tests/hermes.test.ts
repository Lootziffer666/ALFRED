import { describe, it, expect } from "vitest";
import {
  InMemoryHermesDispatcher,
  createOrder,
  transitionOrder,
  canRetry,
  isDuplicate,
  createSession,
  isLeaseExpired,
  detectWorktreeConflict,
  createHandoff,
  acceptHandoff,
} from "@/lib/hermes";
import type { SignedExecutionPlan } from "@/lib/schema/homelab";

function fakePlan(planId = "plan-1"): SignedExecutionPlan {
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

// ── Orders ────────────────────────────────────────────────────────────────────

describe("createOrder", () => {
  it("starts in pending state", () => {
    const o = createOrder(fakePlan());
    expect(o.state).toBe("pending");
    expect(o.attempts).toBe(0);
  });
});

describe("transitionOrder", () => {
  it("sets completedAt when transitioning to completed", () => {
    const o = transitionOrder(createOrder(fakePlan()), "completed");
    expect(o.completedAt).not.toBeNull();
    expect(o.state).toBe("completed");
  });

  it("records failureReason on failed", () => {
    const o = transitionOrder(createOrder(fakePlan()), "failed", { failureReason: "timeout" });
    expect(o.failureReason).toBe("timeout");
  });
});

describe("canRetry", () => {
  it("allows retry when attempts < maxRetries", () => {
    const o = { ...createOrder(fakePlan(), 2), state: "failed" as const, attempts: 1 };
    expect(canRetry(o)).toBe(true);
  });

  it("denies retry when maxRetries exhausted", () => {
    const o = { ...createOrder(fakePlan(), 1), state: "failed" as const, attempts: 1 };
    expect(canRetry(o)).toBe(false);
  });
});

describe("isDuplicate", () => {
  it("detects a running order for the same planId", () => {
    const o = { ...createOrder(fakePlan("p-1")), state: "running" as const };
    expect(isDuplicate([o], "p-1")).toBe(true);
  });

  it("allows a new order when previous is completed", () => {
    const o = { ...createOrder(fakePlan("p-1")), state: "completed" as const };
    expect(isDuplicate([o], "p-1")).toBe(false);
  });
});

// ── Sessions ──────────────────────────────────────────────────────────────────

describe("isLeaseExpired", () => {
  it("returns false when no lease", () => {
    const s = createSession("a1", "t1", "p1", "node-1", null, null);
    expect(isLeaseExpired(s)).toBe(false);
  });

  it("returns true when lease in the past", () => {
    const s = createSession("a1", "t1", "p1", "node-1", null, -1000);
    expect(isLeaseExpired(s)).toBe(true);
  });
});

describe("detectWorktreeConflict (sessions)", () => {
  it("flags two active sessions in same worktree", () => {
    const s1 = createSession("a1", "t1", "p1", "node-1", "worktrees/t1");
    const s2 = createSession("a2", "t2", "p2", "node-1", "worktrees/t1");
    expect(detectWorktreeConflict([s1], "worktrees/t1")).toBe(s1);
    expect(detectWorktreeConflict([s2], "worktrees/t1")).toBe(s2);
  });

  it("permits sessions in different worktrees", () => {
    const s1 = createSession("a1", "t1", "p1", "node-1", "worktrees/t1");
    expect(detectWorktreeConflict([s1], "worktrees/t2")).toBeNull();
  });
});

// ── Handoffs ──────────────────────────────────────────────────────────────────

describe("createHandoff / acceptHandoff", () => {
  it("creates a handoff with no assigned successor", () => {
    const h = createHandoff("a1", "t1", "p1", "sha-abc", "summary", ["step-2"], ["step-1"], []);
    expect(h.toAgentId).toBeNull();
    expect(h.fromAgentId).toBe("a1");
    expect(h.completedSteps).toContain("step-1");
  });

  it("accepts assigns the successor", () => {
    const h = createHandoff("a1", "t1", "p1", null, "summary", [], [], []);
    const accepted = acceptHandoff(h, "a2");
    expect(accepted.toAgentId).toBe("a2");
  });
});

// ── Dispatcher ────────────────────────────────────────────────────────────────

describe("InMemoryHermesDispatcher", () => {
  it("submits a plan and returns an order", async () => {
    const d = new InMemoryHermesDispatcher();
    const order = await d.submit(fakePlan("plan-x"));
    expect(order.state).toBe("pending");
    expect(order.planId).toBe("plan-x");
  });

  it("rejects duplicate plans", async () => {
    const d = new InMemoryHermesDispatcher();
    await d.submit(fakePlan("plan-dup"));
    await expect(d.submit(fakePlan("plan-dup"))).rejects.toThrow();
  });

  it("cancels an order", async () => {
    const d = new InMemoryHermesDispatcher();
    const order = await d.submit(fakePlan("plan-cancel"));
    await d.cancel(order.orderId, "test");
    const updated = await d.getOrder(order.orderId);
    expect(updated?.state).toBe("cancelled");
  });

  it("prevents worktree conflicts via _startSession", async () => {
    const d = new InMemoryHermesDispatcher();
    const o1 = await d.submit(fakePlan("plan-wt1"));
    const o2 = await d.submit(fakePlan("plan-wt2"));
    d._startSession(o1.orderId, "agent-1", "worktrees/t1", "workstation");
    expect(() =>
      d._startSession(o2.orderId, "agent-2", "worktrees/t1", "workstation"),
    ).toThrow(/Worktree-Konflikt/);
  });

  it("streams events for an order", async () => {
    const d = new InMemoryHermesDispatcher();
    const order = await d.submit(fakePlan("plan-evt"));
    const events: unknown[] = [];
    for await (const e of d.streamEvents(order.orderId)) {
      events.push(e);
    }
    expect(events.length).toBeGreaterThanOrEqual(1);
  });
});
