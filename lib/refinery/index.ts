export type {
  RefineryState,
  ConflictClass,
  ConflictRecord,
  RepairVerdict,
  MergeSimulation,
  RepairRule,
} from "./types";
export { classifyConflict, verdictFor, buildConflictRecord } from "./classify";
export {
  createSimulation,
  transition,
  applyConflicts,
  recordPostMergeHealth,
  canMerge,
} from "./simulate";
export type { PrAssessment } from "./pr-gate";
export { assessCommitForPr } from "./pr-gate";
