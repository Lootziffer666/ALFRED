#!/usr/bin/env node
// Daemon CLI entry point: 11 commands for daemon lifecycle management.
// Graceful shutdown: SIGTERM waits 30s for in-flight tick, second signal exits 1.
// Single-instance lock ensures only one daemon per ALFRET_HOME.

import { parseArgs } from "node:util";
import { createInterface } from "node:readline";
import { createContext, disposeContext } from "../lib/daemon/context.js";
import { createLogger } from "../lib/daemon/log.js";
import { acquireLock, releaseLock, LockError } from "../lib/daemon/lock.js";
import { loadConfig } from "../lib/daemon/config.js";
import { loadCredentials, storeCredentials } from "../lib/daemon/credentials.js";
import { loadScopeRegistry, saveScopeRegistry, addRepository } from "../lib/daemon/scope.js";
import { openStore } from "../lib/store/factory.js";
import { startScheduler } from "../lib/daemon/scheduler.js";
import { maidScanJob } from "../lib/daemon/jobs/maid-scan.js";
import { readmeFreshnessJob } from "../lib/daemon/jobs/readme-freshness.js";
import { branchCareJob } from "../lib/daemon/jobs/branch-care.js";

const COMMANDS = [
  "run",
  "once",
  "status",
  "doctor",
  "add-repo",
  "arm",
  "disarm",
  "login",
  "pause",
  "resume",
  "uninstall",
] as const;

type Command = (typeof COMMANDS)[number];

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
    allowPositionals: true,
  });

  const cmd = (positionals[0] as Command | undefined) ?? "run";

  if (values.help || !COMMANDS.includes(cmd)) {
    console.log(`
Daemon CLI for ALFRET.

Commands:
  run              Start daemon loop (reschedule on rate-limit)
  once             Execute single tick (no loop)
  status           Show daemon PID and config
  doctor           Diagnose daemon health
  add-repo <repo>  Register repository for scanning
  arm              Enable writes
  disarm           Disable writes (default)
  login <token>    Store GitHub token
  pause            Pause daemon (SIGTERM → 30s grace, second signal exits 1)
  resume           Resume daemon (resume from tick)
  uninstall        Delete lock, config, credentials, scope

Options:
  -h, --help       Show this help
  -v, --version    Show version
    `);
    process.exit(values.help ? 0 : 1);
  }

  if (values.version) {
    console.log("alfret-daemon v1.0.0");
    process.exit(0);
  }

  try {
    await execCommand(cmd, positionals.slice(1) as string[]);
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

async function execCommand(cmd: Command, args: string[]): Promise<void> {
  switch (cmd) {
    case "run":
      return runDaemon();
    case "once":
      return runOnce();
    case "status":
      return showStatus();
    case "doctor":
      return runDoctor();
    case "add-repo":
      if (!args[0]) throw new Error("Usage: alfret-daemon add-repo <repo>");
      return addRepo(args[0]);
    case "arm":
      return setArmed(true);
    case "disarm":
      return setArmed(false);
    case "login":
      if (!args[0]) throw new Error("Usage: alfret-daemon login <token>");
      return storeToken(args[0]);
    case "pause":
      return pauseDaemon();
    case "resume":
      return resumeDaemon();
    case "uninstall":
      return uninstallDaemon();
  }
}

async function runDaemon(): Promise<void> {
  const log = createLogger({ minLevel: "info" });

  try {
    await acquireLock();
  } catch (err) {
    if (err instanceof LockError) {
      log.error("Lock held", { error: err.message });
      process.exit(1);
    }
    throw err;
  }

  const configResult = await loadConfig({});
  const config = configResult.config;
  const credsResult = await loadCredentials();
  const store = await openStore({ kind: "sqlite" });
  const ctx = await createContext({ config, creds: credsResult, store, log });

  const scheduler = startScheduler({
    ctx,
    jobs: [maidScanJob, readmeFreshnessJob, branchCareJob],
    onTick: (result) => {
      log.info("tick complete", {
        totalDurationMs: result.totalDurationMs,
        repos: result.repos.length,
      });
    },
  });

  let gracefulShutdown = false;

  process.on("SIGTERM", async () => {
    if (gracefulShutdown) {
      log.warn("Second SIGTERM — exiting immediately");
      process.exit(1);
    }

    gracefulShutdown = true;
    log.info("SIGTERM — draining in-flight work (30s)");

    try {
      await scheduler.stop();
      await releaseLock();
      disposeContext(ctx);
      log.info("graceful shutdown complete");
      process.exit(0);
    } catch (err) {
      log.error("shutdown error", { error: String(err) });
      process.exit(1);
    }
  });

  log.info("daemon started", { pid: process.pid });
}

async function runOnce(): Promise<void> {
  const log = createLogger({ minLevel: "info" });

  try {
    await acquireLock();
  } catch (err) {
    if (err instanceof LockError) {
      log.error("Lock held", { error: err.message });
      process.exit(1);
    }
    throw err;
  }

  try {
    const configResult = await loadConfig({});
    const config = configResult.config;
    const credsResult = await loadCredentials();
    const store = await openStore({ kind: "sqlite" });
    const ctx = await createContext({ config, creds: credsResult, store, log });

    const { runOnce } = await import("../lib/daemon/scheduler.js");
    const result = await runOnce(ctx, [maidScanJob, readmeFreshnessJob, branchCareJob]);

    log.info("tick complete", {
      totalDurationMs: result.totalDurationMs,
      repos: result.repos.length,
    });

    disposeContext(ctx);
  } finally {
    await releaseLock();
  }
}

async function showStatus(): Promise<void> {
  const log = createLogger({ minLevel: "info" });

  try {
    await acquireLock();
    console.log("Daemon not running.");
    await releaseLock();
  } catch (err) {
    if (err instanceof LockError) {
      const match = err.message.match(/PID (\d+)/);
      if (match) {
        console.log(`Daemon running as PID ${match[1]}`);
      }
      return;
    }
    throw err;
  }

  const configResult = await loadConfig({});
  console.log("Config:", JSON.stringify(configResult.config, null, 2));
}

async function runDoctor(): Promise<void> {
  const log = createLogger({ minLevel: "info" });

  console.log("=== ALFRET Daemon Health Check ===\n");

  const configResult = await loadConfig({});
  const config = configResult.config;
  console.log("✓ Config loaded");

  const credsResult = await loadCredentials();
  console.log(credsResult.token ? "✓ GitHub token found" : "⚠ No GitHub token");

  const scopeResult = await loadScopeRegistry();
  console.log(`✓ Scope: ${Object.keys(scopeResult.registry.repositories).length} repositories`);

  const store = await openStore({ kind: "sqlite" });
  const ctx = await createContext({ config, creds: credsResult, store, log });

  if (ctx.git) {
    console.log(`✓ Git: ${ctx.git.version} at ${ctx.git.path}`);
  } else {
    console.log("⚠ Git not available");
  }

  console.log(`✓ dryRun: ${config.dryRun}`);
  console.log(`✓ armed: ${config.armed}`);

  try {
    await acquireLock();
    console.log("✓ Lock acquired (daemon not running)");
    await releaseLock();
  } catch (err) {
    if (err instanceof LockError) {
      console.log("✓ Daemon is running");
      return;
    }
    throw err;
  }

  disposeContext(ctx);
}

async function addRepo(repo: string): Promise<void> {
  const { scopePath } = await import("../lib/daemon/paths.js");
  await addRepository(repo, scopePath());
  console.log(`Added repository: ${repo}`);
}

async function setArmed(armed: boolean): Promise<void> {
  const configResult = await loadConfig({});
  const updated = { ...configResult.config, armed };

  const { configPath, writeJson } = await import("../lib/daemon/paths.js");
  await writeJson(configPath(), updated);

  console.log(`Daemon ${armed ? "armed" : "disarmed"}`);
}

async function storeToken(token: string): Promise<void> {
  await storeCredentials(token);
  console.log("Token stored securely");
}

async function pauseDaemon(): Promise<void> {
  try {
    await acquireLock();
    console.log("Daemon not running.");
    await releaseLock();
  } catch (err) {
    if (err instanceof LockError) {
      const match = err.message.match(/PID (\d+)/);
      if (match) {
        const pid = Number(match[1]);
        process.kill(pid, "SIGTERM");
        console.log(`Paused daemon (PID ${pid})`);
      }
      return;
    }
    throw err;
  }
}

async function resumeDaemon(): Promise<void> {
  const log = createLogger({ minLevel: "info" });

  try {
    await acquireLock();
  } catch (err) {
    if (err instanceof LockError) {
      console.log("Daemon is already running.");
      return;
    }
    throw err;
  }

  const configResult = await loadConfig({});
  const config = configResult.config;
  const credsResult = await loadCredentials();
  const store = await openStore({ kind: "sqlite" });
  const ctx = await createContext({ config, creds: credsResult, store, log });

  const { runOnce } = await import("../lib/daemon/scheduler.js");
  await runOnce(ctx, [maidScanJob, readmeFreshnessJob, branchCareJob]);

  disposeContext(ctx);
  await releaseLock();

  console.log("Daemon resumed (single tick)");
}

async function uninstallDaemon(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  rl.question("Uninstall ALFRET daemon? (y/N) ", async (answer) => {
    rl.close();

    if (answer.toLowerCase() !== "y") {
      console.log("Cancelled.");
      return;
    }

    try {
      await releaseLock();
    } catch {
      // Already unlocked or not locked.
    }

    const { promises: fs } = await import("node:fs");
    const { lockPath, configPath, credentialsPath, scopePath } = await import(
      "../lib/daemon/paths.js"
    );

    for (const path of [lockPath(), configPath(), credentialsPath(), scopePath()]) {
      try {
        await fs.unlink(path);
        console.log(`Removed ${path}`);
      } catch {
        // Already removed or doesn't exist.
      }
    }

    console.log("Uninstall complete.");
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
