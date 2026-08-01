// plan §18 — Daemon configuration: schema, loader, resolver.
// Every field has a .default() so {} parses to a complete Config.
// Broken file → refuse to start. Missing file → use defaults + warn.
// Pattern strings are validated as RegExp at load time — a typo fails at startup.

import { z } from "zod";
import { readJson, configPath } from "./paths.js";

// ---------------------------------------------------------------------------
// Zod helpers
// ---------------------------------------------------------------------------

function regexpString(label: string) {
  return z
    .string()
    .refine((s) => {
      try {
        new RegExp(s);
        return true;
      } catch {
        return false;
      }
    }, `${label} is not a valid RegExp pattern`);
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export const repoConfigSchema = z.object({
  /** Whether the daemon may execute PlannedWrites for this repo. Default: false. */
  armed: z.boolean().default(false),

  /** Branches the daemon must never touch (glob-capable strings). */
  protectedBranches: z.array(z.string()).default(["main", "master", "release/*"]),

  /** Paths the daemon must never modify (glob-capable strings). */
  protectedPaths: z.array(z.string()).default([]),

  /** Per-repo override for the global tick interval (ms). */
  tickIntervalMs: z.number().int().min(60_000).optional(),
});

export type RepoConfig = z.infer<typeof repoConfigSchema>;

export const skillsConfigSchema = z.object({
  /** LLM-based skill generation. Default: false (safety invariant). */
  allowLlmGeneration: z.boolean().default(false),
});

export const daemonConfigSchema = z.object({
  /** Global dry-run switch. Default: true. A fresh install observes only. */
  dryRun: z.boolean().default(true),

  /** Global armed switch — overridden per-repo by repositories[n].armed. */
  armed: z.boolean().default(false),

  /** Tick interval in ms. Default: 15 minutes. */
  tickIntervalMs: z.number().int().min(60_000).default(15 * 60 * 1000),

  /** Maximum PlannedWrites executed per tick across all repos. */
  maxWritesPerTick: z.number().int().min(1).default(5),

  /** Maximum PRs the daemon may open per repo per day. */
  maxPrsPerRepoPerDay: z.number().int().min(1).default(3),

  /** Repositories the daemon monitors. Keys are "owner/repo". */
  repositories: z.record(repoConfigSchema).default({}),

  /** Patterns (RegExp strings) marking paths as documentation-relevant. */
  docRelevantGlobs: z.array(regexpString("docRelevantGlob")).default([
    "README\\.md",
    "docs/.*",
    "\\.md$",
  ]),

  skills: skillsConfigSchema.default({}),

  /** Bridge endpoint — where the daemon POSTs status events. */
  bridgeUrl: z.string().url().default("http://localhost:3000/api/daemon/ingest"),

  /** Log level for the JSON line logger. */
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type DaemonConfig = z.infer<typeof daemonConfigSchema>;

/** Resolved config for a single repository — what Jobs read. */
export interface ResolvedRepoConfig extends RepoConfig {
  repository: string;
  tickIntervalMs: number;
  dryRun: boolean;
}

// ---------------------------------------------------------------------------
// Merge order: defaults ← file ← overrides ← ALFRET_DAEMON_* ← CLI flags
// ---------------------------------------------------------------------------

function envOverrides(): Partial<DaemonConfig> {
  const out: Partial<DaemonConfig> = {};

  if (process.env.ALFRET_DAEMON_DRY_RUN !== undefined)
    out.dryRun = process.env.ALFRET_DAEMON_DRY_RUN !== "false";

  if (process.env.ALFRET_DAEMON_ARMED !== undefined)
    out.armed = process.env.ALFRET_DAEMON_ARMED === "true";

  if (process.env.ALFRET_DAEMON_TICK_MS !== undefined)
    out.tickIntervalMs = Number(process.env.ALFRET_DAEMON_TICK_MS);

  if (process.env.ALFRET_DAEMON_LOG_LEVEL !== undefined)
    out.logLevel = process.env.ALFRET_DAEMON_LOG_LEVEL as DaemonConfig["logLevel"];

  if (process.env.ALFRET_DAEMON_BRIDGE_URL !== undefined)
    out.bridgeUrl = process.env.ALFRET_DAEMON_BRIDGE_URL;

  return out;
}

export interface LoadConfigOptions {
  /** Optional: path to a custom config file (for testing). */
  file?: string;

  /** Optional: CLI-level overrides applied after env. */
  cliOverrides?: Partial<DaemonConfig>;
}

export interface LoadConfigResult {
  config: DaemonConfig;
  source: "file" | "defaults";
  warnings: string[];
}

export async function loadConfig(opts: LoadConfigOptions = {}): Promise<LoadConfigResult> {
  const file = opts.file ?? configPath();

  const warnings: string[] = [];

  let raw: unknown = {};

  let source: "file" | "defaults" = "defaults";

  const fromDisk = await readJson<unknown>(file);

  if (fromDisk === null) {
    warnings.push(`Config file not found at ${file} — using defaults.`);
  } else {
    raw = fromDisk;
    source = "file";
  }

  const merged = {
    ...(raw as object),
    ...envOverrides(),
    ...(opts.cliOverrides ?? {}),
  };

  const result = daemonConfigSchema.safeParse(merged);

  if (!result.success) {
    throw new Error(
      `Invalid daemon config at ${file}:\n${result.error.issues
        .map((i) => `  ${i.path.join(".")}: ${i.message}`)
        .join("\n")}`,
    );
  }

  return { config: result.data, source, warnings };
}

/** The single function Jobs call — never the global config object directly. */
export function resolveRepoConfig(
  config: DaemonConfig,
  repository: string,
): ResolvedRepoConfig {
  const repoEntry = config.repositories[repository] ?? repoConfigSchema.parse({});

  return {
    ...repoEntry,
    repository,
    tickIntervalMs: repoEntry.tickIntervalMs ?? config.tickIntervalMs,
    dryRun: config.dryRun,
  };
}
