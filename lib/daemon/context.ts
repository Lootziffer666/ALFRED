// DaemonContext: geteilte Ressourcen, die jeder Job erhält.
// git ist null, wenn `git --version` beim Start scheitert.
// Jobs degradieren dann graceful, anstatt den gesamten Tick abzubrechen.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { DaemonLogger } from "./log.js";
import type { AlfretStore } from "../store/types.js";
import type { DaemonConfig } from "./config.js";
import type { LoadCredentialsResult } from "./credentials.js";

const exec = promisify(execFile);

export interface GitInfo {
  path: string;
  version: string;
}

export interface DaemonContext {
  config: DaemonConfig;
  creds: LoadCredentialsResult;
  store: AlfretStore;
  log: DaemonLogger;
  /** null, wenn git-Binary nicht verfügbar. */
  git: GitInfo | null;
  /** Injizierbar für Tests; default: () => new Date() */
  now: () => Date;
}

async function probeGit(): Promise<GitInfo | null> {
  try {
    const { stdout: ver } = await exec("git", ["--version"]);
    const { stdout: path } = await exec(
      process.platform === "win32" ? "where" : "which",
      ["git"],
    );

    return { path: path.trim(), version: ver.trim() };
  } catch {
    return null;
  }
}

export async function createContext(opts: {
  config: DaemonConfig;
  creds: LoadCredentialsResult;
  store: AlfretStore;
  log: DaemonLogger;
  now?: () => Date;
}): Promise<DaemonContext> {
  const git = await probeGit();

  if (!git) opts.log.warn("git-Binary nicht gefunden — git-abhängige Jobs degradieren");

  return {
    config: opts.config,
    creds: opts.creds,
    store: opts.store,
    log: opts.log,
    git,
    now: opts.now ?? (() => new Date()),
  };
}

export function disposeContext(ctx: DaemonContext): void {
  ctx.store.close();
}
