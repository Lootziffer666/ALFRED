// Context capsules: signed findings for transport and storage.
// Capsule = finding + metadata + signature, verifiable without daemon.

import { createHash, createHmac } from "node:crypto";
import type { MaidFinding } from "../maid/types.js";

export interface FindingCapsule {
  /** Unique ID per repository observation */
  id: string;
  /** Source: "daemon-scan" | "manual" | "batch" */
  source: "daemon-scan" | "manual" | "batch";
  /** Repository name */
  repository: string;
  /** Git commit SHA where finding was observed */
  commitSha: string;
  /** ISO timestamp when observation occurred */
  observedAt: string;
  /** The finding itself */
  finding: MaidFinding;
  /** HMAC-SHA256(JSON + secret) for integrity */
  signature: string;
  /** Public checksum for dedup without verifying signature */
  checksum: string;
}

/**
 * Create a signed capsule for a finding.
 * Secret (from credentials or config) is required for signing.
 */
export function sealCapsule(opts: {
  finding: MaidFinding;
  repository: string;
  commitSha: string;
  source: "daemon-scan" | "manual" | "batch";
  secret: string;
}): FindingCapsule {
  const { finding, repository, commitSha, source, secret } = opts;

  const capsule: Omit<FindingCapsule, "signature" | "checksum"> = {
    id: `${repository}@${commitSha}#${finding.path}#${finding.kind}`,
    source,
    repository,
    commitSha,
    observedAt: new Date().toISOString(),
    finding,
  };

  // Sign the JSON representation
  const payload = JSON.stringify(capsule);
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  const checksum = createHash("sha256").update(payload).digest("hex").slice(0, 12);

  return {
    ...capsule,
    signature,
    checksum,
  };
}

/**
 * Verify capsule signature using the secret.
 * Returns true iff signature is valid.
 */
export function verifyCapsule(capsule: FindingCapsule, secret: string): boolean {
  const { signature, ...withoutSig } = capsule;
  const payload = JSON.stringify(withoutSig);
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  return signature === expected;
}

/**
 * Extract checksum for dedup without verification.
 * Useful for finding duplicates in unverified data.
 */
export function checksumOf(capsule: FindingCapsule): string {
  return capsule.checksum;
}

/**
 * Compute checksum of finding metadata for dedup.
 */
export function computeChecksum(
  repository: string,
  commitSha: string,
  path: string,
  kind: string,
): string {
  const obj = { repository, commitSha, path, kind };
  const payload = JSON.stringify(obj);
  return createHash("sha256").update(payload).digest("hex").slice(0, 12);
}
