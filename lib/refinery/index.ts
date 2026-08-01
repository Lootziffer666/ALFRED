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
