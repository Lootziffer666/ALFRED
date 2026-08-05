// Daemon module entry point: lifecycle, jobs, and utilities.

export { createContext, disposeContext } from "./context";
export type { DaemonContext, GitInfo } from "./context";

export { createLogger } from "./log";
export type { DaemonLogger, LogLevel, LogEntry } from "./log";

export { loadConfig } from "./config";
export { resolveRepoConfig } from "./config";
export type { DaemonConfig, RepoConfig, ResolvedRepoConfig } from "./config";

export { loadCredentials, storeCredentials, redact, secretsOf, scrubSecrets } from "./credentials";
export type { LoadCredentialsResult } from "./credentials";

export { loadScopeRegistry, saveScopeRegistry, addRepository } from "./scope";
export type { ScopeRegistry } from "./scope";

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
} from "./paths";

export { acquireLock, releaseLock } from "./lock";
export { LockError } from "./lock";

export { startScheduler, runOnce, nextDelayMs } from "./scheduler";
export type { SchedulerOptions, SchedulerHandle } from "./scheduler";

export { maidScanJob } from "./jobs/maid-scan";
export type { Job, JobContext, JobResult, PlannedWrite, TickResult } from "./jobs/types";

export { startBridge } from "./bridge";
export type { BridgeMessage, BridgeOptions, BridgeHandle, DaemonStatus } from "./bridge";
