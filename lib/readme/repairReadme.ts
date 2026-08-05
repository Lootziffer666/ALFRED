// Stage 4 — README-Reparatur als eigenständige Funktion.
// Wird sowohl vom Job als auch vom manuellen Repair-Endpunkt genutzt.
// Kein doppelter Implementierungspfad.

import { replaceMarkedBlock } from "./markers";
import type { PlannedWrite } from "../daemon/jobs/types";

export interface RepairReadmeOpts {
  repository: string;
  readmeContent: string;
  branchName: string;
  prNumber: number;
  daemonAuthor: string;
}

export interface RepairReadmeResult {
  changed: boolean;
  reason: string;
  writes: PlannedWrite[];
}

export function buildReadmeRepair(opts: RepairReadmeOpts): RepairReadmeResult {
  const { repository, readmeContent, branchName, prNumber, daemonAuthor } = opts;

  const replacement = replaceMarkedBlock(
    readmeContent,
    buildStatusBlock(repository, prNumber),
    { insertIfMissing: false },
  );

  if (!replacement.changed) {
    return { changed: false, reason: replacement.reason, writes: [] };
  }

  return {
    changed: true,
    reason: "README-Statusblock aktualisiert.",
    writes: [
      {
        kind: "commit-files",
        repository,
        reason: "README-Statusblock aktualisieren (automatisch erkannt).",
        payload: {
          branch: branchName,
          message: "docs: README-Status aktualisieren",
          files: [{ path: "README.md", content: replacement.newContent }],
        },
      } as PlannedWrite,
      {
        kind: "create-pr",
        repository,
        reason: "PR für README-Statusaktualisierung öffnen.",
        payload: {
          head: branchName,
          base: "main",
          title: "docs: README-Status aktualisieren",
          body: `Automatisch erzeugt von ${daemonAuthor}. Nur der markierte Statusblock wurde geändert.`,
        },
      } as PlannedWrite,
    ],
  };
}

function buildStatusBlock(repo: string, prNumber: number): string {
  return `<!-- alfret:begin status -->
**Latest Update:** PR #${prNumber} (${repo})
<!-- alfret:end status -->`;
}
