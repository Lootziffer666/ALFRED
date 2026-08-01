// plan §32 — Merge-Queue: Branches in Merge-Reihenfolge sortieren.

export interface MergeQueueEntry {
  prNumber: number;
  branch: string;
  priority: number;
  createdAt: string;
}

export function sortMergeQueue(entries: MergeQueueEntry[]): MergeQueueEntry[] {
  return [...entries].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export async function enqueueMergeCandidate(
  prNumber: number,
  branch: string,
): Promise<MergeQueueEntry> {
  return {
    prNumber,
    branch,
    priority: 0,
    createdAt: new Date().toISOString(),
  };
}
