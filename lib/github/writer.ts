// GitHub write layer: commit files, create/update PRs, manage branches.
// Operates on PlannedWrites after executor policy decision.

import type { PlannedWrite } from "../daemon/jobs/types.js";

export type GitHubWriteKind = "commit-files" | "create-pr" | "update-pr-branch" | "delete-branch";

export interface CommitPayload {
  files: Array<{ path: string; content: string }>;
  message: string;
  branch: string;
}

export interface PRPayload {
  head: string;
  base: string;
  title: string;
  body: string;
  draft?: boolean;
  labels?: string[];
}

export interface UpdatePRPayload {
  prNumber: number;
  branch: string;
  commit: boolean; // If true, commit files first
  files?: Record<string, string>;
  message?: string;
}

export interface DeleteBranchPayload {
  branch: string;
  force?: boolean;
}

/**
 * Create a planned commit write.
 */
export function planCommit(opts: {
  repository: string;
  reason: string;
  branch: string;
  files: Array<{ path: string; content: string }>;
  message: string;
}): PlannedWrite {
  return {
    kind: "commit-files",
    repository: opts.repository,
    reason: opts.reason,
    payload: {
      branch: opts.branch,
      message: opts.message,
      files: opts.files,
    },
  };
}

/**
 * Create a planned PR creation.
 */
export function planCreatePR(opts: {
  repository: string;
  reason: string;
  head: string;
  base: string;
  title: string;
  body: string;
  draft?: boolean;
  labels?: string[];
}): PlannedWrite {
  return {
    kind: "create-pr",
    repository: opts.repository,
    reason: opts.reason,
    payload: {
      head: opts.head,
      base: opts.base,
      title: opts.title,
      body: opts.body,
      draft: opts.draft ?? false,
      labels: opts.labels ?? [],
    },
  };
}

/**
 * Create a planned PR update.
 */
export function planUpdatePR(opts: {
  repository: string;
  reason: string;
  prNumber: number;
  branch: string;
  files?: Record<string, string>;
  message?: string;
  commit?: boolean;
}): PlannedWrite {
  return {
    kind: "update-pr-branch",
    repository: opts.repository,
    reason: opts.reason,
    payload: {
      prNumber: opts.prNumber,
      branch: opts.branch,
      files: opts.files ?? {},
      message: opts.message ?? "Update",
      commit: opts.commit ?? true,
    },
  };
}

/**
 * Create a planned branch deletion.
 */
export function planDeleteBranch(opts: {
  repository: string;
  reason: string;
  branch: string;
  force?: boolean;
}): PlannedWrite {
  return {
    kind: "delete-branch",
    repository: opts.repository,
    reason: opts.reason,
    payload: {
      branch: opts.branch,
      force: opts.force ?? false,
    },
  };
}

/**
 * Verify planned write structure before execution.
 */
export function validatePlannedWrite(write: PlannedWrite): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!write.repository || typeof write.repository !== "string") {
    errors.push("Missing or invalid repository");
  }

  if (!write.reason || typeof write.reason !== "string") {
    errors.push("Missing or invalid reason");
  }

  switch (write.kind) {
    case "commit-files": {
      const p = write.payload as unknown as CommitPayload;
      if (!p.branch || !p.message || !Array.isArray(p.files)) {
        errors.push("commit-files: missing branch, message, or files");
      }
      if (Array.isArray(p.files) && p.files.length === 0) {
        errors.push("commit-files: no files to commit");
      }
      break;
    }

    case "create-pr": {
      const p = write.payload as unknown as PRPayload;
      if (!p.head || !p.base || !p.title || !p.body) {
        errors.push("create-pr: missing head, base, title, or body");
      }
      if (p.title.length > 256) {
        errors.push("create-pr: title too long (max 256 chars)");
      }
      break;
    }

    case "update-pr-branch": {
      const p = write.payload as unknown as UpdatePRPayload;
      if (!Number.isInteger(p.prNumber) || p.prNumber <= 0) {
        errors.push("update-pr-branch: invalid PR number");
      }
      if (!p.branch) {
        errors.push("update-pr-branch: missing branch");
      }
      break;
    }

    case "delete-branch": {
      const p = write.payload as unknown as DeleteBranchPayload;
      if (!p.branch) {
        errors.push("delete-branch: missing branch");
      }
      break;
    }

    default:
      errors.push(`Unknown write kind: ${write.kind}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Extract audit info from planned write for logging.
 */
export function auditInfoOf(write: PlannedWrite): {
  kind: PlannedWrite["kind"];
  repository: string;
  reason: string;
  target: string; // branch/PR number/etc
} {
  let target = "unknown";

  switch (write.kind) {
    case "commit-files":
      target = (write.payload as unknown as CommitPayload).branch;
      break;
    case "create-pr":
      target = `new PR from ${(write.payload as unknown as PRPayload).branch}`;
      break;
    case "update-pr-branch":
      target = `PR#${(write.payload as unknown as UpdatePRPayload).prNumber}`;
      break;
    case "delete-branch":
      target = (write.payload as unknown as DeleteBranchPayload).branch;
      break;
  }

  return {
    kind: write.kind,
    repository: write.repository,
    reason: write.reason,
    target,
  };
}
