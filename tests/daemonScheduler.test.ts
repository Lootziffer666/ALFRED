import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import type { DaemonContext } from "../lib/daemon/context.js";
import type { Job, JobResult } from "../lib/daemon/jobs/types.js";
import { nextDelayMs, runOnce } from "../lib/daemon/scheduler.js";
import { createLogger } from "../lib/daemon/log.js";
import { openStore } from "../lib/store/factory.js";
import { createContext } from "../lib/daemon/context.js";
import { loadConfig } from "../lib/daemon/config.js";
import { loadCredentials } from "../lib/daemon/credentials.js";

describe("nextDelayMs", () => {
  it("returns base delay when rand = 0", () => {
    const result = nextDelayMs(1000, () => 0);
    expect(result).toBe(1000);
  });

  it("applies 10% jitter at max when rand = 1", () => {
    const result = nextDelayMs(1000, () => 1);
    const jitter = 1000 * 0.1;
    expect(result).toBe(Math.round(1000 + jitter));
  });

  it("applies 5% jitter when rand = 0.5", () => {
    const result = nextDelayMs(1000, () => 0.5);
    const jitter = 1000 * 0.1 * 0.5;
    expect(result).toBe(Math.round(1000 + jitter));
  });

  it("uses Math.random by default", () => {
    const result = nextDelayMs(1000);
    expect(result).toBeGreaterThanOrEqual(1000);
    expect(result).toBeLessThanOrEqual(Math.round(1000 * 1.1));
  });
});

describe("runOnce", () => {
  let ctx: DaemonContext;
  let store: Awaited<ReturnType<typeof openStore>>;

  beforeEach(async () => {
    store = await openStore({ kind: "memory" });
    const config = loadConfig({});
    const creds = loadCredentials();
    const log = createLogger({ level: "error" });
    ctx = await createContext({ config, creds, store, log });
  });

  afterEach(async () => {
    store.close();
  });

  it("executes all repos in order", async () => {
    const config = loadConfig({
      repositories: {
        "repo/a": {},
        "repo/b": {},
        "repo/c": {},
      },
    });

    const executed: string[] = [];
    const job: Job = {
      name: "test",
      async run({ repo }) {
        executed.push(repo.repository);
        return { status: "ok", findings: [], writes: [] };
      },
    };

    const ctxWithRepos = await createContext({
      config,
      creds: loadCredentials(),
      store,
      log: createLogger({ level: "error" }),
    });

    const result = await runOnce(ctxWithRepos, [job]);
    expect(executed).toEqual(["repo/a", "repo/b", "repo/c"]);
    expect(result.repos.length).toBe(3);
  });

  it("counts findings and writes per job", async () => {
    const config = loadConfig({
      repositories: { "repo/test": {} },
    });

    const job: Job = {
      name: "test",
      async run() {
        return {
          status: "ok",
          findings: [{} as any, {} as any],
          writes: [{} as any],
        };
      },
    };

    const ctxWithRepo = await createContext({
      config,
      creds: loadCredentials(),
      store,
      log: createLogger({ level: "error" }),
    });

    const result = await runOnce(ctxWithRepo, [job]);
    expect(result.repos[0].jobResults[0].findingCount).toBe(2);
    expect(result.repos[0].jobResults[0].writeCount).toBe(1);
  });

  it("handles job exceptions gracefully", async () => {
    const config = loadConfig({
      repositories: { "repo/test": {} },
    });

    const job: Job = {
      name: "failing",
      async run() {
        throw new Error("Test error");
      },
    };

    const ctxWithRepo = await createContext({
      config,
      creds: loadCredentials(),
      store,
      log: createLogger({ level: "error" }),
    });

    const result = await runOnce(ctxWithRepo, [job]);
    expect(result.repos[0].jobResults[0].status).toBe("failed");
    expect(result.repos[0].jobResults[0].findingCount).toBe(0);
  });

  it("aborts all remaining repos on rate-limit", async () => {
    const config = loadConfig({
      repositories: {
        "repo/a": {},
        "repo/b": {},
        "repo/c": {},
      },
    });

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

    const ctxWithRepos = await createContext({
      config,
      creds: loadCredentials(),
      store,
      log: createLogger({ level: "error" }),
    });

    const result = await runOnce(ctxWithRepos, [job]);
    expect(executed).toEqual(["repo/a"]);
    expect(result.repos.length).toBe(1);
  });

  it("stores tick in store", async () => {
    const config = loadConfig({
      repositories: { "repo/test": {} },
    });

    const job: Job = {
      name: "test",
      async run() {
        return { status: "ok", findings: [], writes: [] };
      },
    };

    const ctxWithRepo = await createContext({
      config,
      creds: loadCredentials(),
      store,
      log: createLogger({ level: "error" }),
    });

    const result = await runOnce(ctxWithRepo, [job]);
    const stored = await store.get("daemon-tick", result.id);
    expect(stored).toBeDefined();
    expect(stored?.kind).toBe("daemon-tick");
  });

  it("prunes old ticks keeping max 200", async () => {
    const config = loadConfig({
      repositories: { "repo/test": {} },
    });

    const job: Job = {
      name: "test",
      async run() {
        return { status: "ok", findings: [], writes: [] };
      },
    };

    const ctxWithRepo = await createContext({
      config,
      creds: loadCredentials(),
      store,
      log: createLogger({ level: "error" }),
    });

    // Insert 250 ticks
    for (let i = 0; i < 250; i++) {
      await runOnce(ctxWithRepo, [job], new Date(Date.now() + i * 1000));
    }

    // Should only have 200 most recent
    const all = await store.list("daemon-tick");
    expect(all.length).toBeLessThanOrEqual(200);
  });

  it("executes multiple jobs sequentially per repo", async () => {
    const config = loadConfig({
      repositories: { "repo/test": {} },
    });

    const order: string[] = [];
    const job1: Job = {
      name: "first",
      async run() {
        order.push("first");
        return { status: "ok", findings: [], writes: [] };
      },
    };

    const job2: Job = {
      name: "second",
      async run() {
        order.push("second");
        return { status: "ok", findings: [], writes: [] };
      },
    };

    const ctxWithRepo = await createContext({
      config,
      creds: loadCredentials(),
      store,
      log: createLogger({ level: "error" }),
    });

    const result = await runOnce(ctxWithRepo, [job1, job2]);
    expect(order).toEqual(["first", "second"]);
    expect(result.repos[0].jobResults.length).toBe(2);
  });

  it("sets correct status codes", async () => {
    const config = loadConfig({
      repositories: {
        "repo/ok": {},
        "repo/skipped": {},
        "repo/degraded": {},
      },
    });

    const job: Job = {
      name: "test",
      async run({ repo }) {
        switch (repo.repository) {
          case "repo/ok":
            return { status: "ok", findings: [], writes: [] };
          case "repo/skipped":
            return { status: "skipped", findings: [], writes: [] };
          case "repo/degraded":
            return { status: "degraded", findings: [], writes: [] };
          default:
            throw new Error("Unknown repo");
        }
      },
    };

    const ctxWithRepos = await createContext({
      config,
      creds: loadCredentials(),
      store,
      log: createLogger({ level: "error" }),
    });

    const result = await runOnce(ctxWithRepos, [job]);
    expect(result.repos[0].jobResults[0].status).toBe("ok");
    expect(result.repos[1].jobResults[0].status).toBe("skipped");
    expect(result.repos[2].jobResults[0].status).toBe("degraded");
  });

  it("records total duration", async () => {
    const config = loadConfig({
      repositories: { "repo/test": {} },
    });

    const job: Job = {
      name: "test",
      async run() {
        await new Promise((r) => setTimeout(r, 50));
        return { status: "ok", findings: [], writes: [] };
      },
    };

    const ctxWithRepo = await createContext({
      config,
      creds: loadCredentials(),
      store,
      log: createLogger({ level: "error" }),
    });

    const result = await runOnce(ctxWithRepo, [job]);
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(50);
  });
});
