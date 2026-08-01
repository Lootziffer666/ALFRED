// Daemon module entry point: lifecycle, jobs, and utilities.

export { createContext, disposeContext } from "./context.js";
export type { DaemonContext, GitInfo } from "./context.js";

export { createLogger } from "./log.js";
export type { DaemonLogger, LogLevel, LogEntry } from "./log.js";

export { loadConfig } from "./config.js";
export { resolveRepoConfig } from "./config.js";
export type { DaemonConfig, RepoConfig, ResolvedRepoConfig } from "./config.js";

export { loadCredentials, storeCredentials, redact, secretsOf, scrubSecrets } from "./credentials.js";
export type { LoadCredentialsResult } from "./credentials.js";

export { loadScopeRegistry, saveScopeRegistry, addRepository } from "./scope.js";
export type { ScopeRegistry } from "./scope.js";

export {
  alfretHome,
  configPath,
  credentialsPath,
  scopePath,
  lockPath,
  workDir,
  ensureAlfretDirs,
  readJson,
  writeJson,
} from "./paths.js";

export { acquireLock, releaseLock } from "./lock.js";
export { LockError } from "./lock.js";

export { startScheduler, runOnce, nextDelayMs } from "./scheduler.js";
export type { SchedulerOptions, SchedulerHandle } from "./scheduler.js";

export { maidScanJob } from "./jobs/maid-scan.js";
export type { Job, JobContext, JobResult, PlannedWrite, TickResult } from "./jobs/types.js";

export { startBridge } from "./bridge.js";
export type { BridgeMessage, BridgeOptions, BridgeHandle, DaemonStatus } from "./bridge.js";
