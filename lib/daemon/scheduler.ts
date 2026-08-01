// Tick-Scheduler.
// setTimeout-Rekursion (nicht setInterval) — kein Drift-Aufstau.
// Repos sequenziell, Jobs innerhalb eines Repos sequenziell — lesbare Logs.
// Rate-Limit pausiert alle Repos, bis Reset abläuft (Limit ist pro Token, nicht pro Repo).
// nextDelayMs ist eine reine Funktion mit injizierbarem rand — testbar ohne Fake-Timer.

import type { DaemonContext } from "./context.js";
import type { Job, JobResult, TickResult, RepoTickSummary } from "./jobs/types.js";
import { resolveRepoConfig } from "./config.js";

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** Maximaler Jitter: 10 % des Basis-Intervalls. */
const JITTER_FACTOR = 0.1;
/** Pause nach Rate-Limit (ms). */
const RATE_LIMIT_PAUSE_MS = 60_000;
/** Maximale Anzahl gespeicherter Ticks im Store. */
const MAX_STORED_TICKS = 200;

// ---------------------------------------------------------------------------
// Öffentliche API
// ---------------------------------------------------------------------------

export interface SchedulerOptions {
  ctx: DaemonContext;
  jobs: Job[];
  /** Injizierbar für Tests: Math.random-Ersatz. */
  rand?: () => number;
  /** Callback nach jedem Tick — für Tests. */
  onTick?: (result: TickResult) => void;
}

export interface SchedulerHandle {
  stop(): Promise<void>;
}

/** Reine Funktion: nächste Verzögerung mit Jitter.
 *  rand = 0.5 → deterministisch; default: Math.random */
export function nextDelayMs(baseMs: number, rand: () => number = Math.random): number {
  const jitter = baseMs * JITTER_FACTOR * rand();
  return Math.round(baseMs + jitter);
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

export function startScheduler(opts: SchedulerOptions): SchedulerHandle {
  const { ctx, jobs, rand = Math.random, onTick } = opts;

  let stopped = false;
  let rateLimitedUntil = 0;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function scheduleNext(): void {
    if (stopped) return;
    const now = Date.now();
    const rlDelay = Math.max(0, rateLimitedUntil - now);
    const delay =
      rlDelay > 0 ? rlDelay : nextDelayMs(ctx.config.tickIntervalMs, rand);

    timer = setTimeout(async () => {
      if (stopped) return;
      if (inFlight) {
        ctx.log.warn("vorheriger Tick läuft noch — übersprungen");
        scheduleNext();
        return;
      }

      inFlight = true;
      try {
        await tick();
      } finally {
        inFlight = false;
        scheduleNext();
      }
    }, delay);
  }

  async function tick(now: Date = ctx.now()): Promise<TickResult> {
    const result = await runOnceInternal(ctx, jobs, now, (pauseMs) => {
      rateLimitedUntil = Date.now() + pauseMs;
      ctx.log.warn("Rate-Limit — alle Repos pausiert", {
        resumeAt: new Date(rateLimitedUntil).toISOString(),
      });
    });

    onTick?.(result);

    return result;
  }

  scheduleNext();

  return {
    async stop() {
      stopped = true;

      if (timer !== null) clearTimeout(timer);

      const deadline = Date.now() + 30_000;

      while (inFlight && Date.now() < deadline) {
        await sleep(100);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// runOnce — standalone für Tests (keine Fake-Timer nötig)
// ---------------------------------------------------------------------------

export async function runOnce(
  ctx: DaemonContext,
  jobs: Job[],
  now: Date = ctx.now(),
): Promise<TickResult> {
  return runOnceInternal(ctx, jobs, now, (_pauseMs) => {});
}

// ---------------------------------------------------------------------------
// Intern
// ---------------------------------------------------------------------------

async function runOnceInternal(
  ctx: DaemonContext,
  jobs: Job[],
  now: Date,
  onRateLimit: (pauseMs: number) => void,
): Promise<TickResult> {
  const tickStart = now.getTime();
  const repositories = Object.keys(ctx.config.repositories);
  const repoSummaries: RepoTickSummary[] = [];

  repoLoop: for (const repository of repositories) {
    const repoStart = Date.now();
    const repoLog = ctx.log.child({ repository });
    const resolvedRepo = resolveRepoConfig(ctx.config, repository);
    const jobResults: RepoTickSummary["jobResults"] = [];

    for (const job of jobs) {
      const jobLog = repoLog.child({ job: job.name });
      let result: JobResult;

      try {
        result = await job.run({ ctx, repo: resolvedRepo, log: jobLog });
      } catch (err) {
        jobLog.error("Job hat unerwartet geworfen", { error: String(err) });
        result = {
          status: "failed",
          findings: [],
          writes: [],
          meta: { error: String(err) },
        };
      }

      jobLog.info("job abgeschlossen", {
        status: result.status,
        findings: result.findings.length,
        writes: result.writes.length,
      });

      jobResults.push({
        job: job.name,
        status: result.status,
        findingCount: result.findings.length,
        writeCount: result.writes.length,
      });

      if (result.meta?.rateLimited) {
        onRateLimit(RATE_LIMIT_PAUSE_MS);
        break repoLoop;
      }
    }

    repoSummaries.push({
      repository,
      jobResults,
      durationMs: Date.now() - repoStart,
    });
  }

  const tick: TickResult = {
    kind: "daemon-tick",
    id: now.toISOString(),
    tickedAt: now.toISOString(),
    repos: repoSummaries,
    totalDurationMs: Date.now() - tickStart,
  };

  await pruneAndStoreTick(ctx, tick);
  return tick;
}

async function pruneAndStoreTick(ctx: DaemonContext, tick: TickResult): Promise<void> {
  const all = await ctx.store.list<TickResult>("daemon-tick");

  const sorted = [...all].sort((a, b) => a.tickedAt.localeCompare(b.tickedAt));

  const excess = sorted.slice(0, Math.max(0, sorted.length - MAX_STORED_TICKS + 1));

  for (const old of excess) await ctx.store.delete("daemon-tick", old.id);

  await ctx.store.put(tick);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
