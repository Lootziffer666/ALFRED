// plan §35 — Timeline Snapshots: Daemon-Zustand zu Zeitpunkten.

export interface TimelineSnapshot {
  timestamp: string;
  repository: string;
  state: {
    findings: number;
    activeJobs: number;
    lastTickDurationMs: number;
  };
}

export interface Timeline {
  snapshots: TimelineSnapshot[];
}

export function createSnapshot(
  repository: string,
  findings: number,
  activeJobs: number,
  tickDuration: number,
): TimelineSnapshot {
  return {
    timestamp: new Date().toISOString(),
    repository,
    state: {
      findings,
      activeJobs,
      lastTickDurationMs: tickDuration,
    },
  };
}

export function createTimeline(): Timeline {
  return { snapshots: [] };
}

export function addSnapshot(timeline: Timeline, snapshot: TimelineSnapshot): void {
  timeline.snapshots.push(snapshot);
}
