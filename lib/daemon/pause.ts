// plan §36 — Kill-Switch: ~/.alfret/PAUSED
// Im Scheduler-Tick wird das als erste Prüfung eingehängt: existiert die Datei,
// kehrt der Tick sofort zurück, ohne Repos zu berühren.

import { existsSync } from "node:fs";
import path from "node:path";
import { alfretHome } from "./paths.js";

export function pausePath(): string {
  return path.join(alfretHome(), "PAUSED");
}

export function isPaused(): boolean {
  return existsSync(pausePath());
}
