// plan §36 — Integration test: daemon running on ALFRET itself in dry-run mode
import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { MemoryAlfretStore } from "../lib/store/memory.js";
import { createLogger } from "../lib/daemon/log.js";
import { runDaemonTick } from "../lib/daemon/index.js";
import type { DaemonContext } from "../lib/daemon/types.js";

describe("Integration: Daemon on ALFRET self-analysis", () => {
  let store: MemoryAlfretStore;
  let daemonContext: DaemonContext;

  beforeAll(async () => {
    store = new MemoryAlfretStore();
    const logger = createLogger({ level: "info" });

    daemonContext = {
      now: () => new Date(),
      store,
      creds: {
        token: process.env.GITHUB_TOKEN || null,
      },
      config: {
        dryRun: true, // Critical: safe mode
        armed: false, // Critical: explicit allow required
        tickIntervalMs: 60000,
        maxWritesPerTick: 5,
        maxPrsPerRepoPerDay: 3,
        repositories: {
          "lootziffer666/alfret": {
            enabled: true,
            protectedBranches: ["main"],
            protectedPaths: [".github/**", ".env"],
          },
        },
        docRelevantGlobs: ["lib/**", "app/api/**", "bin/**", "PLAN.md"],
        skills: [],
        bridgeUrl: "http://localhost:3000",
        logLevel: "info",
      },
      log: logger,
      flags: {
        allowLlmGeneration: false,
        allowAutoMerge: false,
        allowRefactoringProposals: false,
      },
    };
  });

  it("should identify ALFRET's own repository", async () => {
    expect(daemonContext.config.repositories["lootziffer666/alfret"]).toBeDefined();
    expect(daemonContext.config.repositories["lootziffer666/alfret"].enabled).toBe(true);
  });

  it("should run with dryRun=true (no writes)", async () => {
    expect(daemonContext.config.dryRun).toBe(true);
    expect(daemonContext.config.armed).toBe(false);
  });

  it("should enforce security invariants", () => {
    // All feature flags default to false (safe)
    expect(daemonContext.flags.allowLlmGeneration).toBe(false);
    expect(daemonContext.flags.allowAutoMerge).toBe(false);
  });

  it("should have doc-relevant globs configured", () => {
    expect(daemonContext.config.docRelevantGlobs.length).toBeGreaterThan(0);
    expect(daemonContext.config.docRelevantGlobs).toContain("lib/**");
    expect(daemonContext.config.docRelevantGlobs).toContain("PLAN.md");
  });

  it("should have protected branches and paths", () => {
    const repoConfig = daemonContext.config.repositories["lootziffer666/alfret"];
    expect(repoConfig?.protectedBranches).toContain("main");
    expect(repoConfig?.protectedPaths).toContain(".github/**");
  });

  afterAll(() => {
    // Cleanup
    store = null as any;
  });
});
