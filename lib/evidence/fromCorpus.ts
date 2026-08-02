// Stage 3 — Übersetzungsfunktion PersistedEvidence → EvidenceRef (UI-Vertrag).
// Löst die Zwei-Typen-Frage ohne den UI-Prop-Vertrag anzufassen.

import type { PersistedEvidence } from "../corpus/persistence.js";

// EvidenceRef ist der flache UI-Vertrag aus lib/evidence/ref.ts
export interface EvidenceRef {
  id: string;
  summary: string;
  findingCapsuleId: string;
  decisionIds: string[];
  repository: string;
}

export function evidenceRecordToRef(ev: PersistedEvidence): EvidenceRef {
  return {
    id: ev.id,
    summary: ev.summary,
    findingCapsuleId: ev.findingCapsuleId,
    decisionIds: ev.decisionIds,
    repository: ev.repository,
  };
}
