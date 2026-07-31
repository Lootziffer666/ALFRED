import { describe, it, expect } from "vitest";
import {
  EMPTY_SCOPE_REGISTRY,
  ScopeViolationError,
  assertScope,
  checkScope,
  isPathProtected,
  parseScopeRegistry,
  repositoryKey,
  scopeFor,
} from "@/lib/scope/registry";
import { scopeActionSchema, type ScopeAction } from "@/lib/schema/scope";

const REGISTRY = parseScopeRegistry({
  repositories: {
    "Lootziffer666/SHADED": {
      observe: true,
      prepareChanges: true,
      createPullRequest: true,
      refineryMerge: true,
      destructiveCleanup: "approval-required",
      protectedPaths: ["contracts/", "docs/weltgesetze.md"],
      dataClass: "private",
      autonomy: "propose",
    },
    "external/example": {
      observe: true,
      executeInSandbox: false,
      write: false,
    },
  },
});

const ALL_ACTIONS = scopeActionSchema.options as ScopeAction[];

describe("scope registry", () => {
  it("parses JSON and fills unstated permissions with a refusal", () => {
    const entry = scopeFor(REGISTRY, "external/example")!;
    expect(entry.observe).toBe(true);
    expect(entry.write).toBe(false);
    expect(entry.prepareChanges).toBe(false);
    expect(entry.refineryMerge).toBe(false);
    // Unstated defaults are the cautious ones.
    expect(entry.dataClass).toBe("private");
    expect(entry.autonomy).toBe("observe-only");
  });

  it("rejects a malformed registry rather than guessing", () => {
    expect(() => parseScopeRegistry({ repositories: { "a/b": { observe: "maybe" } } })).toThrow();
  });

  it("accepts a repository as a string or as an owner/name pair", () => {
    expect(repositoryKey({ owner: "Lootziffer666", name: "SHADED" })).toBe("Lootziffer666/SHADED");
    expect(checkScope(REGISTRY, { owner: "Lootziffer666", name: "SHADED" }, "observe").outcome).toBe("allowed");
  });
});

describe("checkScope", () => {
  it("allows only what was explicitly released", () => {
    expect(checkScope(REGISTRY, "Lootziffer666/SHADED", "prepare-changes").outcome).toBe("allowed");
    expect(checkScope(REGISTRY, "Lootziffer666/SHADED", "refinery-merge").outcome).toBe("allowed");
  });

  it("escalates an action the entry does not release", () => {
    const decision = checkScope(REGISTRY, "Lootziffer666/SHADED", "execute-in-sandbox");
    expect(decision.outcome).toBe("escalated");
    expect(decision.reason).toMatch(/nicht freigegeben/);
  });

  it("escalates every action on a repository that is not in the registry", () => {
    for (const action of ALL_ACTIONS) {
      const decision = checkScope(REGISTRY, "stranger/unknown", action);
      expect(decision.outcome, `${action} must not be allowed off-registry`).toBe("escalated");
      expect(decision.reason).toMatch(/nicht in der Scope Registry/);
    }
  });

  it("escalates everything when the registry is empty", () => {
    for (const action of ALL_ACTIONS) {
      expect(checkScope(EMPTY_SCOPE_REGISTRY, "Lootziffer666/SHADED", action).outcome).toBe("escalated");
    }
  });

  it("keeps a destructive action behind an explicit confirmation", () => {
    const decision = checkScope(REGISTRY, "Lootziffer666/SHADED", "destructive-cleanup");
    expect(decision.outcome).toBe("approval-required");
  });

  it("never lets an observe-only entry be written to", () => {
    for (const action of ["write", "prepare-changes", "create-pull-request", "refinery-merge"] as const) {
      expect(checkScope(REGISTRY, "external/example", action).outcome).toBe("escalated");
    }
    expect(checkScope(REGISTRY, "external/example", "observe").outcome).toBe("allowed");
  });
});

describe("assertScope", () => {
  it("returns the decision when the action is released", () => {
    expect(assertScope(REGISTRY, "Lootziffer666/SHADED", "observe").outcome).toBe("allowed");
  });

  it("throws for an off-registry repository, carrying the decision", () => {
    try {
      assertScope(REGISTRY, "stranger/unknown", "write");
      expect.unreachable("assertScope must not allow an off-registry write");
    } catch (err) {
      expect(err).toBeInstanceOf(ScopeViolationError);
      expect((err as ScopeViolationError).decision.outcome).toBe("escalated");
    }
  });

  it("throws rather than proceeding on approval-required", () => {
    expect(() => assertScope(REGISTRY, "Lootziffer666/SHADED", "destructive-cleanup")).toThrow(ScopeViolationError);
  });
});

describe("protected paths", () => {
  it("protects a declared prefix and the exact file", () => {
    expect(isPathProtected(REGISTRY, "Lootziffer666/SHADED", "contracts/shaded.json")).toBe(true);
    expect(isPathProtected(REGISTRY, "Lootziffer666/SHADED", "docs/weltgesetze.md")).toBe(true);
    expect(isPathProtected(REGISTRY, "Lootziffer666/SHADED", "editor/facade.js")).toBe(false);
  });

  it("treats every path of an unknown repository as protected", () => {
    expect(isPathProtected(REGISTRY, "stranger/unknown", "README.md")).toBe(true);
  });

  it("does not let a prefix match a merely similar directory name", () => {
    expect(isPathProtected(REGISTRY, "Lootziffer666/SHADED", "contracts-old/x.json")).toBe(false);
  });
});
