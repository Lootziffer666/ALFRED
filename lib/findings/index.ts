// Findings module: capsules, dedup, provenance tracking.

export { sealCapsule, verifyCapsule, checksumOf, computeChecksum } from "./capsule.js";
export type { FindingCapsule } from "./capsule.js";

export { dedup, filterMerged, sortMerged, dedupStats } from "./dedup.js";
export type { MergedFinding } from "./dedup.js";

export {
  provenanceOf,
  tagProvenance,
  filterByProvenance,
  separateProvenance,
  provenanceStats,
} from "./provenance.js";
export type { FindingSource, FindingProvenance, ProvenanceTag } from "./provenance.js";
