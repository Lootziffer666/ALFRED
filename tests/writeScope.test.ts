// Der Schreib-Pfad ist die einzige Stelle im Repo, die einen mutierenden
// GitHub-Request absetzt. Er hatte zwei Löcher:
//
//   1. assertScope() prüfte nur den globalen armed-Schalter des Daemons. Ein
//      scharfgeschalteter Daemon durfte damit in JEDES Repository schreiben —
//      auch in eines, das nie in ~/.alfret/scope.json eingetragen wurde.
//   2. isPathProtected() kannte die protectedPaths des Repositories nicht,
//      sondern nur eine eingebaute Liste. Was der Betreiber selbst geschützt
//      hatte, war wirkungslos.
//
// Diese Tests halten beide Löcher zu. Kein Test hier darf jemals das Netz
// erreichen: jeder erwartete Ausgang ist eine Ablehnung VOR dem Request.

import { describe, it, expect } from "vitest";
import { executeWrite } from "../lib/github/write";
import { assertScope, isPathProtected } from "../lib/scope";
import { EMPTY_SCOPE_REGISTRY } from "../lib/scope/index";
import type { ScopeRegistry } from "../lib/scope/types";
import type { PlannedWrite } from "../lib/daemon/jobs/types";

const REGISTRY: ScopeRegistry = {
  repositories: {
    "owner/armed": {
      armed: true,
      allowedActions: ["commitFiles", "createBranch"],
      protectedPaths: ["contracts/", "docs/weltgesetze.md"],
      protectedBranches: ["main"],
    },
    "owner/listed-but-cold": {
      armed: false,
      allowedActions: ["commitFiles"],
      protectedPaths: [],
      protectedBranches: ["main"],
    },
  },
};

function commit(repository: string, paths: string[]): PlannedWrite {
  return {
    kind: "commit-files",
    repository,
    reason: "test",
    payload: {
      branch: "alfret/test",
      message: "test",
      files: paths.map((path) => ({ path, content: "x" })),
    },
  } as unknown as PlannedWrite;
}

/** Any call to this means the gate let a request through that it should not have. */
const forbiddenFetch: typeof fetch = () => {
  throw new Error("ein Request wurde abgesetzt, obwohl der Scope ihn verbieten muss");
};

describe("assertScope", () => {
  it("refuses while the daemon is globally disarmed", () => {
    expect(() =>
      assertScope(REGISTRY, "owner/armed", "commitFiles", { armed: false }),
    ).toThrow(/not armed/);
  });

  it("refuses a repository that is not in the registry at all", () => {
    expect(() =>
      assertScope(REGISTRY, "stranger/unknown", "commitFiles", { armed: true }),
    ).toThrow(/Scope Registry/);
  });

  it("refuses a registered but disarmed repository", () => {
    expect(() =>
      assertScope(REGISTRY, "owner/listed-but-cold", "commitFiles", { armed: true }),
    ).toThrow(/not armed/);
  });

  it("refuses an action the repository never released", () => {
    expect(() =>
      assertScope(REGISTRY, "owner/armed", "destructiveCleanup", { armed: true }),
    ).toThrow(/nicht freigegeben/);
  });

  it("allows a released action on an armed, registered repository", () => {
    expect(() =>
      assertScope(REGISTRY, "owner/armed", "commitFiles", { armed: true }),
    ).not.toThrow();
  });
});

describe("isPathProtected", () => {
  it("protects everything in a repository that is not registered", () => {
    expect(isPathProtected(REGISTRY, "stranger/unknown", "src/x.ts")).toBe(true);
  });

  it("honours the repository's own protectedPaths prefix", () => {
    expect(isPathProtected(REGISTRY, "owner/armed", "contracts/shaded.json")).toBe(true);
    expect(isPathProtected(REGISTRY, "owner/armed", "docs/weltgesetze.md")).toBe(true);
  });

  it("keeps the built-in floor even where the registry lists nothing", () => {
    expect(isPathProtected(REGISTRY, "owner/armed", "package.json")).toBe(true);
    expect(isPathProtected(REGISTRY, "owner/armed", ".env.local")).toBe(true);
    expect(isPathProtected(REGISTRY, "owner/armed", "secrets/token")).toBe(true);
  });

  it("leaves ordinary source files alone", () => {
    expect(isPathProtected(REGISTRY, "owner/armed", "lib/daemon/log.ts")).toBe(false);
  });
});

describe("executeWrite scope gate", () => {
  it("refuses a write to a repository outside the registry", async () => {
    const result = await executeWrite(commit("stranger/unknown", ["src/x.ts"]), {
      token: "t",
      dryRun: false,
      armed: true,
      scope: REGISTRY,
      fetchImpl: forbiddenFetch,
    });

    expect(result.ok).toBe(false);
    expect(result.applied).toBe(false);
    expect(result.reason).toMatch(/Scope Registry/);
  });

  it("refuses everything when no registry is supplied at all", async () => {
    const result = await executeWrite(commit("owner/armed", ["src/x.ts"]), {
      token: "t",
      dryRun: false,
      armed: true,
      fetchImpl: forbiddenFetch,
    });

    expect(result.applied).toBe(false);
  });

  it("refuses the whole commit when one file is protected", async () => {
    const result = await executeWrite(
      commit("owner/armed", ["lib/ok.ts", "contracts/shaded.json"]),
      {
        token: "t",
        dryRun: false,
        armed: true,
        scope: REGISTRY,
        fetchImpl: forbiddenFetch,
      },
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/contracts\/shaded\.json/);
  });

  it("reaches dry-run only once the whole gate has passed", async () => {
    const result = await executeWrite(commit("owner/armed", ["lib/ok.ts"]), {
      token: "t",
      dryRun: true,
      armed: true,
      scope: REGISTRY,
      fetchImpl: forbiddenFetch,
    });

    expect(result.ok).toBe(true);
    expect(result.applied).toBe(false);
    expect(result.reason).toBe("dryRun");
  });

  it("treats the empty registry as 'nothing released'", async () => {
    const result = await executeWrite(commit("owner/armed", ["lib/ok.ts"]), {
      token: "t",
      dryRun: true,
      armed: true,
      scope: EMPTY_SCOPE_REGISTRY,
      fetchImpl: forbiddenFetch,
    });

    expect(result.applied).toBe(false);
  });
});
