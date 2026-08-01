import { describe, it, expect } from "vitest";
import {
  assessContext,
  initialLoopState,
  nextPhase,
  advanceLoop,
  LoopSupervisor,
} from "@/lib/supervisor";
import { InMemoryHermesDispatcher } from "@/lib/hermes";
import type { SupervisorContext } from "@/lib/supervisor";

function ctx(overrides: Partial<SupervisorContext> = {}): SupervisorContext {
  return {
    objective: "repository.reasoning auf workstation",
    blockers: [],
    evidenceSufficient: true,
    lastOrderSucceeded: null,
    iteration: 0,
    ...overrides,
  };
}

describe("assessContext", () => {
  it("authorizes when evidence is sufficient and no blockers", () => {
    expect(assessContext(ctx()).decision).toBe("authorize");
  });

  it("defers when blockers are present", () => {
    const v = assessContext(ctx({ blockers: ["GPU voll"] }));
    expect(v.decision).toBe("defer");
  });

  it("defers when evidence is insufficient", () => {
    const v = assessContext(ctx({ evidenceSufficient: false }));
    expect(v.decision).toBe("defer");
  });

  it("shrinks when last order failed", () => {
    const v = assessContext(ctx({ lastOrderSucceeded: false }));
    expect(v.decision).toBe("shrink");
  });

  it("escalates at max iterations", () => {
    const v = assessContext(ctx({ iteration: 20 }));
    expect(v.decision).toBe("escalate");
  });
});

describe("nextPhase", () => {
  it("follows the happy path: assess→plan→authorize→observe→verify→update→assess", () => {
    const phases = ["assess", "plan", "authorize", "observe", "verify", "update"] as const;
    const expected = ["plan", "authorize", "observe", "verify", "update", "assess"] as const;
    for (let i = 0; i < phases.length; i++) {
      expect(nextPhase(phases[i], "authorize")).toBe(expected[i]);
    }
  });

  it("returns idle on escalate", () => {
    expect(nextPhase("assess", "escalate")).toBe("idle");
  });

  it("returns assess on defer", () => {
    expect(nextPhase("plan", "defer")).toBe("assess");
  });

  it("returns plan on shrink", () => {
    expect(nextPhase("authorize", "shrink")).toBe("plan");
  });
});

describe("LoopSupervisor", () => {
  it("starts in assess phase", () => {
    const d = new InMemoryHermesDispatcher();
    const s = new LoopSupervisor(d);
    expect(s.loopState().phase).toBe("assess");
  });

  it("advances to plan after authorize verdict", () => {
    const d = new InMemoryHermesDispatcher();
    const s = new LoopSupervisor(d);
    s.assess(ctx());
    expect(s.loopState().phase).toBe("plan");
  });

  it("stays in assess when deferred", () => {
    const d = new InMemoryHermesDispatcher();
    const s = new LoopSupervisor(d);
    s.assess(ctx({ blockers: ["node offline"] }));
    expect(s.loopState().phase).toBe("assess");
  });
});
