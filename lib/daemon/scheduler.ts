// Tick-Scheduler.
// setTimeout-Rekursion (nicht setInterval) — kein Drift-Aufstau.
// Repos sequenziell, Jobs innerhalb eines Repos sequenziell — lesbare Logs.
// Rate-Limit pausiert alle Repos, bis Reset abläuft (Limit ist pro Token, nicht pro Repo).
// nextDelayMs ist eine reine Funktion mit injizierbarem rand — testbar ohne Fake-Timer.

import type { DaemonContext } from "./context";
import type { Job, JobResult, TickResult, RepoTickSummary } from "./jobs/types";
import { resolveRepoConfig } from "./config";
import { sealCapsule } from "../findings/capsule";
import { logPlannedWrite, resolveWrite, plannedWriteId } from "./writes-log";
import { recordAudit, type AuditOutcome } from "./audit";

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

      const capsuleSecret =
        process.env.ALFRET_CAPSULE_SECRET ?? ctx.creds.token;

      for (let fi = 0; fi < result.findings.length; fi++) {
        const capsule = sealCapsule({
          finding: result.findings[fi],
          repository: resolvedRepo.repository,
          commitSha: "HEAD",
          source: "daemon-scan",
          secret: capsuleSecret,
        });

        await ctx.store.put({
          kind: "finding-capsule" as const,
          ...capsule,
        });
      }

      for (let wi = 0; wi < result.writes.length; wi++) {
        await logPlannedWrite(ctx.store, {
          write: result.writes[wi],
          tickId: now.toISOString(),
          jobName: job.name,
          index: wi,
          status: "pending-approval",
        });

        // Armed-Gate — kein echter GitHub-API-Call, solange nicht explizit armed
        if (ctx.config.armed && !ctx.config.dryRun) {
          const { executeWrite } = await import("../github/write");
          const writeResult = await executeWrite(result.writes[wi], {
            token: ctx.creds.token,
            dryRun: false,
            armed: true,
            // Der globale armed-Schalter allein reicht nicht: die Registry
            // entscheidet, welches Repository welche Aktion freigegeben hat.
            scope: ctx.scope,
          });

          const outcome: AuditOutcome = writeResult.applied ? "executed" : "denied";
          await resolveWrite(
            ctx.store,
            plannedWriteId(
              result.writes[wi].repository,
              now.toISOString(),
              job.name,
              wi,
            ),
            writeResult.applied ? "executed" : "denied",
          );
          await recordAudit(
            ctx.store,
            {
              repository: resolvedRepo.repository,
              jobId: job.name,
              tickId: now.toISOString(),
              write: result.writes[wi],
              outcome,
              reason: writeResult.reason,
              occurredAt: new Date().toISOString(),
            },
            wi,
          );
        } else if (ctx.config.dryRun) {
          // Dry-run: Audit-Eintrag mit outcome "dry-run", kein API-Call
          await recordAudit(
            ctx.store,
            {
              repository: resolvedRepo.repository,
              jobId: job.name,
              tickId: now.toISOString(),
              write: result.writes[wi],
              outcome: "dry-run",
              occurredAt: new Date().toISOString(),
            },
            wi,
          );
        }
      }

      jobResults.push({
        job: job.name,
        status: result.status,
        findingCount: result.findings.length,
        writeCount: result.writes.length,
      });

      if (result.meta?.rateLimited) {
        onRateLimit(RATE_LIMIT_PAUSE_MS);
        // Der Abbruch sprang bisher an dem push unten vorbei: der Tick meldete
        // dann null bearbeitete Repositories, obwohl Jobs gelaufen waren,
        // Findings versiegelt und Writes protokolliert wurden. Der Tick-Eintrag
        // widersprach damit dem Audit-Log. Was getan wurde, wird auch berichtet.
        repoSummaries.push({
          repository,
          jobResults,
          durationMs: Date.now() - repoStart,
        });
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
