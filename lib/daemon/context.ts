// DaemonContext: geteilte Ressourcen, die jeder Job erhält.
// git ist null, wenn `git --version` beim Start scheitert.
// Jobs degradieren dann graceful, anstatt den gesamten Tick abzubrechen.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { DaemonLogger } from "./log";
import type { AlfretStore } from "../store/types";
import type { DaemonConfig } from "./config";
import type { LoadCredentialsResult } from "./credentials";
import type { ScopeRegistry } from "../scope/types";
import { EMPTY_SCOPE_REGISTRY } from "../scope/index";
import { loadScopeRegistry } from "./scope";

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
  /**
   * Die Freigaben aus ~/.alfret/scope.json. Jeder mutierende Pfad prüft sie —
   * ohne Eintrag ist ein Repository nicht freigegeben (fail-closed).
   */
  scope: ScopeRegistry;
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
  /** Übersteuert das Laden von der Platte — für Tests. */
  scope?: ScopeRegistry;
  now?: () => Date;
}): Promise<DaemonContext> {
  const git = await probeGit();

  if (!git) opts.log.warn("git-Binary nicht gefunden — git-abhängige Jobs degradieren");

  let scope = opts.scope;
  if (!scope) {
    try {
      const loaded = await loadScopeRegistry();
      for (const w of loaded.warnings) opts.log.warn(w);
      scope = loaded.registry;
    } catch (err) {
      // Eine kaputte scope.json darf nicht in "alles erlaubt" umschlagen.
      opts.log.error("scope.json unlesbar — keine Freigaben aktiv", {
        error: String(err),
      });
      scope = EMPTY_SCOPE_REGISTRY;
    }
  }

  return {
    config: opts.config,
    creds: opts.creds,
    store: opts.store,
    log: opts.log,
    git,
    scope,
    now: opts.now ?? (() => new Date()),
  };
}

export function disposeContext(ctx: DaemonContext): void {
  ctx.store.close();
}
