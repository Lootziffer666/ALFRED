// plan §34 — Handoff Profiles: Daemon-Zustand für Übergabe dokumentieren.

export interface HandoffProfile {
  repository: string;
  daemonVersion: string;
  lastRun: string;
  findings: number;
  activeJobs: string[];
  nextSchedule: string;
  notes: string;
}

export function createHandoffProfile(
  repository: string,
  daemonVersion: string,
): HandoffProfile {
  return {
    repository,
    daemonVersion,
    lastRun: new Date().toISOString(),
    findings: 0,
    activeJobs: [],
    nextSchedule: "",
    notes: "",
  };
}

export function summarizeProfile(profile: HandoffProfile): string {
  return `Handoff: ${profile.repository} v${profile.daemonVersion}`;
}
