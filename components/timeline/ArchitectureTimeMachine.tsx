// plan §35 — React Component: Architecture Time Machine (Raum IX).

import type { Timeline } from "../../lib/timeline/snapshot.js";
import type { TurningPoint } from "../../lib/timeline/turningPoints.js";

interface ArchitectureTimeMachineProps {
  timeline: Timeline;
  turningPoints: TurningPoint[];
}

export function ArchitectureTimeMachine({
  timeline,
  turningPoints,
}: ArchitectureTimeMachineProps) {
  return (
    <div className="architecture-time-machine">
      <h2>Raum IX — Architecture Time Machine</h2>
      <div className="timeline">
        {timeline.snapshots.map((snapshot) => (
          <div key={snapshot.timestamp} className="snapshot">
            <div className="time">{snapshot.timestamp}</div>
            <div className="state">
              Findings: {snapshot.state.findings}, Jobs: {snapshot.state.activeJobs}
            </div>
          </div>
        ))}
      </div>
      <div className="turning-points">
        {turningPoints.map((point, idx) => (
          <div key={idx} className={`turning-point ${point.kind}`}>
            <span className="kind">{point.kind}</span>
            <span className="description">{point.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
