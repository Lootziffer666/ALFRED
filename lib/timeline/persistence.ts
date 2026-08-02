import type { AlfretStore } from "../store/types.js";

export interface TimelineSnapshot {
  kind: "timeline-snapshot";
  id: string; // `${repository}::${tickedAt}`
  repository: string;
  tickedAt: string;
  findingCount: number;
  writeCount: number;
  turningPoints: Array<{
    kind: "rate-limit" | "first-pr" | "merge-conflict";
    detail: string;
    occurredAt: string;
  }>;
}

export async function saveSnapshot(
  store: AlfretStore,
  snapshot: Omit<TimelineSnapshot, "kind" | "id">,
): Promise<void> {
  const entity: TimelineSnapshot = {
    kind: "timeline-snapshot",
    id: `${snapshot.repository}::${snapshot.tickedAt}`,
    ...snapshot,
  };

  await store.put(entity);
}

export async function loadTimeline(
  store: AlfretStore,
  repository: string,
): Promise<TimelineSnapshot[]> {
  const all = await store.list<TimelineSnapshot>("timeline-snapshot");
  return all
    .filter((s) => s.repository === repository)
    .sort((a, b) => a.tickedAt.localeCompare(b.tickedAt));
}
