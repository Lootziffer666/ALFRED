// plan §34b — React Component: Fusebox Visualisierung.

import type { FuseState } from "../../lib/health/fuseControl";

interface FuseBoxProps {
  fuses: FuseState[];
  onReset?: (subsystem: string) => void;
}

export function FuseBox({ fuses, onReset }: FuseBoxProps) {
  return (
    <div className="fusebox">
      {fuses.map((fuse) => (
        <div key={fuse.subsystem} className={`fuse ${fuse.blown ? "blown" : ""}`}>
          <span>{fuse.subsystem}</span>
          {fuse.blown && (
            <button onClick={() => onReset?.(fuse.subsystem)}>Reset</button>
          )}
        </div>
      ))}
    </div>
  );
}
