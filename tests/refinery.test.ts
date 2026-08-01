import { describe, it, expect } from "vitest";
import {
  classifyConflict,
  verdictFor,
  buildConflictRecord,
  createSimulation,
  applyConflicts,
  recordPostMergeHealth,
  canMerge,
  transition,
} from "@/lib/refinery";

describe("classifyConflict", () => {
  it("classifies lockfile conflict", () => {
    expect(classifyConflict("bun.lockb", "")).toBe("lockfile");
  });

  it("classifies .d.ts as generated-file", () => {
    expect(classifyConflict("lib/schema/homelab.d.ts", "")).toBe("generated-file");
  });

  it("classifies lib/schema/ path as contract-change", () => {
    expect(classifyConflict("lib/schema/homelab.ts", "")).toBe("contract-change");
  });

  it("classifies test deletion as removed-test", () => {
    expect(classifyConflict("tests/foo.test.ts", "-import { describe }")).toBe("removed-test");
  });

  it("classifies weakened test", () => {
    expect(classifyConflict("tests/bar.test.ts", "+test.skip(")).toBe("weakened-test");
  });

  it("falls back to semantic-unknown for unrecognized changes", () => {
    expect(classifyConflict("lib/homelab/planner.ts", "+const x = 2;")).toBe("semantic-unknown");
  });

});

describe("verdictFor", () => {
  it("lockfile is auto-repairable", () => {
    expect(verdictFor("lockfile")).toBe("repaired");
  });

  it("removed-test blocks merge", () => {
    expect(verdictFor("removed-test")).toBe("merge-blocked");
  });

  it("contract-change escalates", () => {
    expect(verdictFor("contract-change")).toBe("escalation-required");
  });

  it("semantic-unknown escalates", () => {
    expect(verdictFor("semantic-unknown")).toBe("escalation-required");
  });

});

describe("applyConflicts", () => {
  it("marks simulation clean with no conflicts", () => {
    const sim = createSimulation("pr-1", "abc", "def");
    const result = applyConflicts(sim, []);
    expect(result.clean).toBe(true);
    expect(result.state).toBe("repaired");
  });

  it("rejects when a test is removed", () => {
    const sim = createSimulation("pr-2", "abc", "def");
    const result = applyConflicts(sim, [
      { path: "tests/foo.test.ts", hunk: "-import", detail: "Test removed" },
    ]);
    expect(result.state).toBe("rejected");
    expect(result.clean).toBe(false);
  });

  it("escalates on contract-change", () => {
    const sim = createSimulation("pr-3", "abc", "def");
    const result = applyConflicts(sim, [
      { path: "lib/schema/homelab.ts", hunk: "+export type", detail: "Schema extended" },
    ]);
    expect(result.state).toBe("escalated");
  });

});

describe("recordPostMergeHealth", () => {
  it("marks post-merge-verified when health passes", () => {
    const sim = { ...createSimulation("pr-4", "a", "b"), state: "merged" as const };
    const result = recordPostMergeHealth(sim, true);
    expect(result.state).toBe("post-merge-verified");
    expect(result.postMergeHealthPassed).toBe(true);
  });

  it("rejects when post-merge health fails", () => {
    const sim = { ...createSimulation("pr-5", "a", "b"), state: "merged" as const };
    const result = recordPostMergeHealth(sim, false);
    expect(result.state).toBe("rejected");
    expect(result.postMergeHealthPassed).toBe(false);
  });

  it("throws when called before merge", () => {
    const sim = createSimulation("pr-6", "a", "b");
    expect(() => recordPostMergeHealth(sim, true)).toThrow();
  });

});

describe("canMerge", () => {
  it("permits merge only in queue-ready or final-rebase-check", () => {
    const base = createSimulation("pr-7", "a", "b");
    expect(canMerge({ ...base, state: "queue-ready" })).toBe(true);
    expect(canMerge({ ...base, state: "final-rebase-check" })).toBe(true);
    expect(canMerge({ ...base, state: "repaired" })).toBe(false);
    expect(canMerge({ ...base, state: "merged" })).toBe(false);
  });

});
