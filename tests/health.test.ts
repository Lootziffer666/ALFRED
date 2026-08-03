import { describe, it, expect } from "vitest";
import { assessHealth, recommendFallback, detectWorktreeConflict } from "@/lib/health";
import type { Heartbeat } from "@/lib/health";

function hb(overrides: Partial<Heartbeat> = {}): Heartbeat {
  return {
    agentId: "agent-1",
    taskId: "task-1",
    sessionId: "session-1",
    phase: "patch",
    headSha: "abc123",
    lastCheckpoint: null,
    lastCommand: null,
    exitCode: null,
    lastEvidence: null,
    model: "mid-8b-q4",
    provider: "ollama",
    worktree: "worktrees/task-1",
    lease: null,
    blocker: null,
    status: "healthy",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe("assessHealth", () => {
  it("returns healthy for recent heartbeat", () => {
    const h = hb({ timestamp: new Date().toISOString() });
    expect(assessHealth(h)).toBe("healthy");
  });

  it("returns stalled after 6 minutes", () => {
    const old = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    expect(assessHealth(hb({ timestamp: old }))).toBe("stalled");
  });

  it("returns dead after 21 minutes", () => {
    const old = new Date(Date.now() - 21 * 60 * 1000).toISOString();
    expect(assessHealth(hb({ timestamp: old }))).toBe("dead");
  });

  it("returns degraded when blocker is set", () => {
    expect(assessHealth(hb({ blocker: "waiting for gpu" }))).toBe("degraded");
  });

});

describe("recommendFallback", () => {
  it("suggests resume-checkpoint when stalled with checkpoint", () => {
    const h = hb({ lastCheckpoint: "checkpoint-42" });
    expect(recommendFallback("stalled", h)).toBe("resume-checkpoint");
  });

  it("suggests handoff-new-agent when stalled without checkpoint", () => {
    expect(recommendFallback("stalled", hb({ lastCheckpoint: null }))).toBe("handoff-new-agent");
  });

  it("suggests salvage-commits when dead but has headSha", () => {
    expect(recommendFallback("dead", hb({ headSha: "abc" }))).toBe("salvage-commits");
  });

  it("escalates supervisor when dead and no headSha", () => {
    expect(recommendFallback("dead", hb({ headSha: null }))).toBe("escalate-supervisor");
  });

  it("always escalates on poisoned", () => {
    expect(recommendFallback("poisoned", hb())).toBe("escalate-supervisor");
  });

});

describe("detectWorktreeConflict", () => {
  it("detects two active agents in the same worktree", () => {
    const agents: Heartbeat[] = [
      hb({ agentId: "a1", worktree: "worktrees/task-1", status: "healthy" }),
      hb({ agentId: "a2", worktree: "worktrees/task-1", status: "healthy" }),
    ];
    const conflict = detectWorktreeConflict(agents);
    expect(conflict).not.toBeNull();
    expect(conflict!.agents).toContain("a1");
    expect(conflict!.agents).toContain("a2");
  });

  it("returns null when agents are in different worktrees", () => {
    const agents: Heartbeat[] = [
      hb({ agentId: "a1", worktree: "worktrees/task-1" }),
      hb({ agentId: "a2", worktree: "worktrees/task-2" }),
    ];
    expect(detectWorktreeConflict(agents)).toBeNull();
  });

  it("ignores dead agents when checking for conflicts", () => {
    const agents: Heartbeat[] = [
      hb({ agentId: "a1", worktree: "worktrees/task-1", status: "healthy" }),
      hb({ agentId: "a2", worktree: "worktrees/task-1", status: "dead" }),
    ];
    expect(detectWorktreeConflict(agents)).toBeNull();
  });

});
