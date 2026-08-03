// plan §29 — Schleifenschutz, VERPFLICHTEND. Entity-kind "daemon-job-state",
// id `readme-freshness@${repository}`, mit lastProposedForPrNumber und
// openPrNumber. Nie zweimal für dieselbe PR-Nummer vorschlagen —
// offener Vorschlag → skipped.

import type { AlfretStore } from "../../store/types";

export interface DaemonJobState {
  kind: "daemon-job-state";
  id: string; // `${jobName}@${repository}`
  lastProposedForPrNumber: number | null;
  openPrNumber: number | null;
  updatedAt: string;
}

export function jobStateId(jobName: string, repository: string): string {
  return `${jobName}@${repository}`;
}

export async function getJobState(
  store: AlfretStore,
  jobName: string,
  repository: string,
): Promise<DaemonJobState | undefined> {
  return store.get<DaemonJobState>(
    "daemon-job-state",
    jobStateId(jobName, repository),
  );
}

export async function saveJobState(
  store: AlfretStore,
  state: DaemonJobState,
): Promise<void> {
  await store.put(state);
}

// true, wenn bereits ein offener PR für dieses Anliegen existiert.
export function hasOpenProposal(state: DaemonJobState | undefined | null): boolean {
  return state?.openPrNumber !== null && state?.openPrNumber !== undefined;
}
