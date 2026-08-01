// GitHub module: write operations and branch management.

export {
  planCommit,
  planCreatePR,
  planUpdatePR,
  planDeleteBranch,
  validatePlannedWrite,
  auditInfoOf,
} from "./writer.js";
export type {
  GitHubWriteKind,
  CommitPayload,
  PRPayload,
  UpdatePRPayload,
  DeleteBranchPayload,
} from "./writer.js";

export { compareRefs } from "./compareRefs.js";
export type { CompareRefsResult } from "./compareRefs.js";
