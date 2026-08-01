// plan §18 — Canonical path layout for ~/.alfret/.
// Mirrors runner/src/identity.ts: mkdir 0o700, writeJson 0o600.
// No other module may hardcode these paths.

import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";

/** Root directory — override via ALFRET_HOME env var. */
export function alfretHome(): string {
  return process.env.ALFRET_HOME ?? join(homedir(), ".alfret");
}

export function configPath(): string {
  return join(alfretHome(), "config.json");
}

export function credentialsPath(): string {
  return join(alfretHome(), "credentials.json");
}

export function scopePath(): string {
  return join(alfretHome(), "scope.json");
}

export function lockPath(): string {
  return join(alfretHome(), "daemon.lock");
}

export function workDir(): string {
  return join(alfretHome(), "work");
}

/** Ensure ~/.alfret/ and ~/.alfret/work/ exist with 0o700. */
export async function ensureAlfretDirs(): Promise<void> {
  await mkdir(alfretHome(), { recursive: true, mode: 0o700 });
  await mkdir(workDir(), { recursive: true, mode: 0o700 });
}

/** Write a JSON file. Sensitive files use mode 0o600 (default). */
export async function writeJson(
  file: string,
  value: unknown,
  mode = 0o600,
): Promise<void> {
  await writeFile(file, JSON.stringify(value, null, 2) + "\n", { mode });
}

/** Read a JSON file, return null on any error (missing, malformed). */
export async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

/** Return the file's permission bits (e.g. 0o600). */
export async function fileMode(file: string): Promise<number> {
  return (await stat(file)).mode & 0o777;
}
