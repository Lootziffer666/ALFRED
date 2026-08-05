// GitHub module: write operations and branch management.

export {
  planCommit,
  planCreatePR,
  planUpdatePR,
  planDeleteBranch,
  validatePlannedWrite,
  auditInfoOf,
} from "./writer";
export type {
  GitHubWriteKind,
  CommitPayload,
  PRPayload,
  UpdatePRPayload,
  DeleteBranchPayload,
} from "./writer";

export { compareRefs } from "./compareRefs";
export type { CompareRefsResult } from "./compareRefs";
