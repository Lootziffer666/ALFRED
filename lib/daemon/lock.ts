// PID-Lockfile. process.kill(pid, 0) unterscheidet lebende von verwaisten Prozessen.
// Verwaiste Locks (Crash) werden still überschrieben.

import { readFile, writeFile, unlink } from "node:fs/promises";
import { lockPath } from "./paths.js";

export class LockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LockError";
  }
}

/** Lock erwerben. Wirft LockError, wenn ein lebender Prozess ihn hält. */
export async function acquireLock(file = lockPath()): Promise<void> {
  let existingPid: number | null = null;

  try {
    existingPid = Number(await readFile(file, "utf8"));
  } catch {
    // Keine Lock-Datei — frei.
  }

  if (existingPid !== null && !Number.isNaN(existingPid)) {
    if (isAlive(existingPid)) {
      throw new LockError(
        `Daemon läuft bereits als PID ${existingPid}. ` + `Stoppe ihn zuerst: kill ${existingPid}`,
      );
    }

    // Verwaister Lock — sicher überschreiben.
  }

  await writeFile(file, String(process.pid), "utf8");
}

/** Lock freigeben. Sicher, auch wenn die Datei bereits fehlt. */
export async function releaseLock(file = lockPath()): Promise<void> {
  try {
    await unlink(file);
  } catch {
    // Bereits weg — kein Fehler.
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
