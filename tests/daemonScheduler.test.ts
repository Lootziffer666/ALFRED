// Scheduler-Kern: Jitter, Tick-Reihenfolge, Fehlertoleranz, Rate-Limit-Abbruch,
// Persistenz und Pruning.
//
// Diese Datei lag als ein einziger auskommentierter Block im Repo — gegen
// `bun:test` geschrieben und gegen eine ältere Signatur von loadConfig()
// (synchron, mit `repositories` direkt in den Optionen). Das Ergebnis war eine
// Test-Datei ohne einen einzigen Test, an der die Suite mit "No test suite
// found" scheiterte. Hier neu gegen vitest und die heutige API.
//
// Der Context wird direkt gebaut statt über createContext(): der echte
// Konstruktor sucht git, liest ~/.alfret/scope.json und würde den Test an die
// Maschine binden, auf der er läuft.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DaemonContext } from "../lib/daemon/context";
import type { Job } from "../lib/daemon/jobs/types";
import { nextDelayMs, runOnce } from "../lib/daemon/scheduler";
import { createLogger } from "../lib/daemon/log";
import { daemonConfigSchema } from "../lib/daemon/config";
import { EMPTY_SCOPE_REGISTRY } from "../lib/scope/index";
import { MemoryStore } from "../lib/store/memory";
import type { MaidFinding } from "../lib/maid/types";
import type { PlannedWrite } from "../lib/daemon/jobs/types";

describe("nextDelayMs", () => {
  it("returns base delay when rand = 0", () => {
    expect(nextDelayMs(1000, () => 0)).toBe(1000);
  });

  it("applies 10% jitter at max when rand = 1", () => {
    expect(nextDelayMs(1000, () => 1)).toBe(Math.round(1000 + 1000 * 0.1));
  });

  it("applies 5% jitter when rand = 0.5", () => {
    expect(nextDelayMs(1000, () => 0.5)).toBe(Math.round(1000 + 1000 * 0.1 * 0.5));
  });

  it("uses Math.random by default", () => {
    const result = nextDelayMs(1000);
    expect(result).toBeGreaterThanOrEqual(1000);
    expect(result).toBeLessThanOrEqual(Math.round(1000 * 1.1));
  });
});

describe("runOnce", () => {
  let store: MemoryStore;

  function contextFor(repositories: string[]): DaemonContext {
    const config = daemonConfigSchema.parse({
      repositories: Object.fromEntries(repositories.map((r) => [r, {}])),
    });

    return {
      config,
      creds: { token: "test-token", source: "env", fingerprint: "test" },
      store,
      log: createLogger({ minLevel: "error", sink: () => {} }),
      git: null,
      scope: EMPTY_SCOPE_REGISTRY,
      now: () => new Date(),
    } as DaemonContext;
  }

  const okJob = (name: string, onRun?: (repo: string) => void): Job => ({
    name,
    async run({ repo }) {
      onRun?.(repo.repository);
      return { status: "ok", findings: [], writes: [] };
    },
  });

  beforeEach(() => {
    store = new MemoryStore();
  });

  afterEach(() => {
    store.close();
  });

  it("executes all repos in order", async () => {
    const executed: string[] = [];
    const result = await runOnce(contextFor(["repo/a", "repo/b", "repo/c"]), [
      okJob("test", (r) => executed.push(r)),
    ]);

    expect(executed).toEqual(["repo/a", "repo/b", "repo/c"]);
    expect(result.repos.length).toBe(3);
  });

  it("counts findings and writes per job", async () => {
    const finding: MaidFinding = {
      kind: "leftover-todo",
      severity: "info",
      path: "lib/x.ts",
      detail: "TODO",
      autoFixable: false,
      observedAt: new Date().toISOString(),
    };
    const write = {
      kind: "create-branch",
      repository: "repo/test",
      reason: "test",
      payload: { branch: "alfret/test" },
    } as unknown as PlannedWrite;

    const job: Job = {
      name: "test",
      async run() {
        return { status: "ok", findings: [finding, finding], writes: [write] };
      },
    };

    const result = await runOnce(contextFor(["repo/test"]), [job]);
    expect(result.repos[0].jobResults[0].findingCount).toBe(2);
    expect(result.repos[0].jobResults[0].writeCount).toBe(1);
  });

  it("handles job exceptions gracefully", async () => {
    const job: Job = {
      name: "failing",
      async run() {
        throw new Error("Test error");
      },
    };

    const result = await runOnce(contextFor(["repo/test"]), [job]);
    expect(result.repos[0].jobResults[0].status).toBe("failed");
    expect(result.repos[0].jobResults[0].findingCount).toBe(0);
  });

  it("aborts all remaining repos on rate-limit", async () => {
    const executed: string[] = [];
    const job: Job = {
      name: "test",
      async run({ repo }) {
        executed.push(repo.repository);
        if (repo.repository === "repo/a") {
          return {
            status: "degraded",
            findings: [],
            writes: [],
            meta: { rateLimited: true },
          };
        }
        return { status: "ok", findings: [], writes: [] };
      },
    };

    const result = await runOnce(contextFor(["repo/a", "repo/b", "repo/c"]), [job]);
    expect(executed).toEqual(["repo/a"]);
    expect(result.repos.length).toBe(1);
  });

  it("stores tick in store", async () => {
    const result = await runOnce(contextFor(["repo/test"]), [okJob("test")]);
    const stored = await store.get("daemon-tick", result.id);
    expect(stored).toBeDefined();
    expect(stored?.kind).toBe("daemon-tick");
  });

  it("prunes old ticks keeping max 200", async () => {
    const ctx = contextFor(["repo/test"]);
    const job = okJob("test");

    for (let i = 0; i < 250; i++) {
      await runOnce(ctx, [job], new Date(Date.now() + i * 1000));
    }

    const all = await store.list("daemon-tick");
    expect(all.length).toBeLessThanOrEqual(200);
  });

  it("executes multiple jobs sequentially per repo", async () => {
    const order: string[] = [];
    const result = await runOnce(contextFor(["repo/test"]), [
      okJob("first", () => order.push("first")),
      okJob("second", () => order.push("second")),
    ]);

    expect(order).toEqual(["first", "second"]);
    expect(result.repos[0].jobResults.length).toBe(2);
  });

  it("sets correct status codes", async () => {
    const job: Job = {
      name: "test",
      async run({ repo }) {
        switch (repo.repository) {
          case "repo/ok":
            return { status: "ok", findings: [], writes: [] };
          case "repo/skipped":
            return { status: "skipped", findings: [], writes: [] };
          default:
            return { status: "degraded", findings: [], writes: [] };
        }
      },
    };

    const result = await runOnce(
      contextFor(["repo/ok", "repo/skipped", "repo/degraded"]),
      [job],
    );
    expect(result.repos[0].jobResults[0].status).toBe("ok");
    expect(result.repos[1].jobResults[0].status).toBe("skipped");
    expect(result.repos[2].jobResults[0].status).toBe("degraded");
  });

  it("records total duration", async () => {
    const job: Job = {
      name: "test",
      async run() {
        await new Promise((r) => setTimeout(r, 50));
        return { status: "ok", findings: [], writes: [] };
      },
    };

    const result = await runOnce(contextFor(["repo/test"]), [job]);
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(50);
  });
});
