// plan §35 — Turning Points: bedeutsame Momente in der Daemon-Geschichte.

export type TurningPointKind = "first-pr" | "merge-conflict" | "rate-limit" | "rollback";

export interface TurningPoint {
  kind: TurningPointKind;
  timestamp: string;
  repository: string;
  description: string;
}

export function recordTurningPoint(
  kind: TurningPointKind,
  repository: string,
  description: string,
): TurningPoint {
  return {
    kind,
    timestamp: new Date().toISOString(),
    repository,
    description,
  };
}

export function getTurningPointsForRepository(
  points: TurningPoint[],
  repository: string,
): TurningPoint[] {
  return points.filter((p) => p.repository === repository);
}
