import { describe, expect, it } from "vitest";
import { buildAcceptanceReport } from "@/lib/audit";
import type { ChangedFile, Handoff } from "@/lib/schema";

function makeHandoff(overrides: Partial<Handoff> = {}): Handoff {
  return {
    id: "handoff-test",
    repo: { owner: "octo", name: "widget-kit", ref: "main" },
    currentVerifiedState: "n/a",
    objective: "test objective",
    nonGoals: [],
    constraints: [],
    relevantFiles: ["src/feature.ts"],
    deliverables: [],
    acceptanceCriteria: [{ id: "c1", text: "Implement the feature in src/feature.ts" }],
    requiredTestsAndEvidence: [],
    prohibitedChanges: ["Do not modify src/legacy.ts"],
    stopConditions: [],
    responseFormat: "",
    sourceFindingIds: [],
    createdAt: new Date(0).toISOString(),
    ...overrides,
  };
}

function file(overrides: Partial<ChangedFile>): ChangedFile {
  return { path: "src/feature.ts", status: "modified", additions: 1, deletions: 0, ...overrides };
}

describe("buildAcceptanceReport", () => {
  it("marks a criterion passed when the diff touches the named file and contains a matching keyword", () => {
    const handoff = makeHandoff();
    const report = buildAcceptanceReport({
      handoff,
      changedFiles: [file({ path: "src/feature.ts", patchExcerpt: "+export function feature() {}" })],
      source: { kind: "demo_fixture" },
    });
    expect(report.criteria[0].verdict).toBe("passed");
  });

  it("marks a criterion partially_passed when only a weak signal is present", () => {
    const handoff = makeHandoff({
      acceptanceCriteria: [{ id: "c1", text: "Implement caching behavior somewhere" }],
    });
    const report = buildAcceptanceReport({
      handoff,
      changedFiles: [file({ path: "src/other.ts", patchExcerpt: "+function caching() {}" })],
      source: { kind: "demo_fixture" },
    });
    expect(report.criteria[0].verdict).toBe("partially_passed");
  });

  it("marks a criterion not_proven when the diff has no relevant evidence", () => {
    const handoff = makeHandoff();
    const report = buildAcceptanceReport({
      handoff,
      changedFiles: [file({ path: "src/unrelated.ts", patchExcerpt: "+const noop = () => {};" })],
      source: { kind: "demo_fixture" },
    });
    expect(report.criteria[0].verdict).toBe("not_proven");
  });

  it("marks a criterion failed when the diff touches a prohibited file", () => {
    const handoff = makeHandoff();
    const report = buildAcceptanceReport({
      handoff,
      changedFiles: [file({ path: "src/legacy.ts", patchExcerpt: "+ hack" })],
      source: { kind: "demo_fixture" },
    });
    expect(report.criteria[0].verdict).toBe("failed");
  });

  it("marks a criterion not_applicable when it describes a non-diffable property", () => {
    const handoff = makeHandoff({
      acceptanceCriteria: [{ id: "c1", text: "The app must never write to the repository" }],
    });
    const report = buildAcceptanceReport({
      handoff,
      changedFiles: [file({ path: "src/other.ts" })],
      source: { kind: "demo_fixture" },
    });
    expect(report.criteria[0].verdict).toBe("not_applicable");
  });

  it("never reports not_proven as passed regardless of an agent's completion claim", () => {
    const handoff = makeHandoff();
    const report = buildAcceptanceReport({
      handoff,
      changedFiles: [file({ path: "src/unrelated.ts" })],
      source: { kind: "demo_fixture" },
      agentSummary: "Implemented the feature in src/feature.ts, all done.",
    });
    expect(report.criteria[0].verdict).toBe("not_proven");
    expect(report.unsupportedClaims.length).toBeGreaterThan(0);
  });

  it("does not flag a claim as unsupported when the criterion actually passed", () => {
    const handoff = makeHandoff();
    const report = buildAcceptanceReport({
      handoff,
      changedFiles: [file({ path: "src/feature.ts", patchExcerpt: "+export function feature() {}" })],
      source: { kind: "demo_fixture" },
      agentSummary: "Implemented the feature in src/feature.ts, all done.",
    });
    expect(report.criteria[0].verdict).toBe("passed");
    expect(report.unsupportedClaims).toHaveLength(0);
  });

  it("summarizes verdict counts across all criteria", () => {
    const handoff = makeHandoff({
      acceptanceCriteria: [
        { id: "c1", text: "Implement the feature in src/feature.ts" },
        { id: "c2", text: "The app must never write to the repository" },
      ],
    });
    const report = buildAcceptanceReport({
      handoff,
      changedFiles: [file({ path: "src/feature.ts", patchExcerpt: "+export function feature() {}" })],
      source: { kind: "demo_fixture" },
    });
    expect(report.summary).toContain("1 passed");
    expect(report.criteria).toHaveLength(2);
  });
});
