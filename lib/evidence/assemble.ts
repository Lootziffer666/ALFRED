// Stage 3 — Baut eine vollständige EvidenceChain aus echten Store-Daten.
// Kein In-Memory-Stub — echte Capsule + zugehörige Decisions + Sibling-Findings.

import type { AlfretStore } from "../store/types";
import type { FindingCapsule } from "../findings/capsule";
import { loadEvidence } from "../corpus/persistence";
import { loadDecisions } from "../corpus/persistence";
import { evidenceRecordToRef, type EvidenceRef } from "./fromCorpus";

export interface EvidenceChain {
  capsuleId: string;
  finding: FindingCapsule["finding"];
  repository: string;
  observedAt: string;
  evidence: EvidenceRef[];
  relatedDecisions: Array<{ id: string; rationale: string; status: string }>;
  siblingCount: number;
  explanation: string;
}

export async function buildEvidenceChain(
  store: AlfretStore,
  findingCapsuleId: string,
): Promise<EvidenceChain | null> {
  const capsule = await store.get<FindingCapsule & { kind: "finding-capsule" }>(
    "finding-capsule",
    findingCapsuleId,
  );

  if (!capsule) return null;

  const [evidenceRecords, decisions, allCapsules] = await Promise.all([
    loadEvidence(store, findingCapsuleId),
    loadDecisions(store, capsule.repository),
    store.list<FindingCapsule & { kind: "finding-capsule" }>("finding-capsule"),
  ]);

  const refs = evidenceRecords.map(evidenceRecordToRef);
  const evidenceDecisionIds = new Set(refs.flatMap((r) => r.decisionIds));
  const relatedDecisions = decisions
    .filter((d) => evidenceDecisionIds.has(d.id))
    .map((d) => ({ id: d.id, rationale: d.rationale, status: d.status }));

  const siblings = allCapsules.filter(
    (c) =>
      c.id !== findingCapsuleId &&
      c.repository === capsule.repository &&
      c.finding.kind === capsule.finding.kind,
  );

  const explanation = buildExplanation(capsule, relatedDecisions, siblings.length);

  return {
    capsuleId: capsule.id,
    finding: capsule.finding,
    repository: capsule.repository,
    observedAt: capsule.observedAt,
    evidence: refs,
    relatedDecisions,
    siblingCount: siblings.length,
    explanation,
  };
}

function buildExplanation(
  capsule: FindingCapsule,
  decisions: Array<{ rationale: string }>,
  siblingCount: number,
): string {
  const parts: string[] = [
    `Finding «${capsule.finding.kind}» in ${capsule.repository} — ${capsule.finding.path}.`,
    capsule.finding.detail ?? "",
  ];

  if (decisions.length > 0) {
    parts.push(
      `Zugehörige Entscheidungen: ${decisions.map((d) => d.rationale).join("; ")}.`,
    );
  }

  if (siblingCount > 0) {
    parts.push(`${siblingCount} weiteres Finding gleichen Typs im selben Repo.`);
  }

  return parts.filter(Boolean).join(" ");
}
