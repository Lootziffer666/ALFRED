// plan §32 — Branch-Zustand bewerten: merge-ready, needs-rebase, blocked.

export type BranchStatus = "merge-ready" | "needs-rebase" | "blocked" | "unknown";

export interface BranchAssessment {
  branch: string;
  status: BranchStatus;
  aheadBy: number;
  behindBy: number;
  ciPassing: boolean;
  reviewsComplete: boolean;
}

export function assessBranchStatus(
  aheadBy: number,
  behindBy: number,
  ciPassing: boolean,
  reviewsComplete: boolean,
): BranchStatus {
  if (!reviewsComplete) return "blocked";
  if (!ciPassing) return "blocked";
  if (behindBy > 0) return "needs-rebase";
  if (aheadBy > 0) return "merge-ready";
  return "unknown";
}
