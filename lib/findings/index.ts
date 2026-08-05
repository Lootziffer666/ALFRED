// Findings module: capsules, dedup, provenance tracking.

export { sealCapsule, verifyCapsule, checksumOf, computeChecksum } from "./capsule";
export type { FindingCapsule } from "./capsule";

export { dedup, filterMerged, sortMerged, dedupStats } from "./dedup";
export type { MergedFinding } from "./dedup";

export {
  provenanceOf,
  tagProvenance,
  filterByProvenance,
  separateProvenance,
  provenanceStats,
} from "./provenance";
export type { FindingSource, FindingProvenance, ProvenanceTag } from "./provenance";
