// Stage 3 — Persistenz-Wrapper für DecisionLedger, EvidenceStore, ProjectGraph.
// Die In-Memory-Logik in lib/corpus/ bleibt unverändert — dieser Layer
// speichert/lädt Entities und rehydriert die In-Memory-Strukturen.

import type { AlfretStore } from "../store/types";

// ── Decision ──────────────────────────────────────────────────────────────

export interface PersistedDecision {
  kind: "decision";
  id: string; // = decisionId
  repository: string;
  status: string; // "active" | "superseded"
  rationale: string;
  alternatives: string[];
  createdAt: string;
  supersededAt: string | null;
  supersededBy: string | null;
  tags: string[];
}

export async function recordDecision(
  store: AlfretStore,
  decision: Omit<PersistedDecision, "kind">,
): Promise<void> {
  await store.put({ kind: "decision", ...decision });
}

export async function loadDecisions(
  store: AlfretStore,
  repository?: string,
): Promise<PersistedDecision[]> {
  const all = await store.list<PersistedDecision>("decision");
  return repository ? all.filter((d) => d.repository === repository) : all;
}

// ── Evidence ──────────────────────────────────────────────────────────────

export interface PersistedEvidence {
  kind: "evidence-record";
  id: string;
  repository: string;
  findingCapsuleId: string;
  decisionIds: string[];
  summary: string;
  createdAt: string;
}

export async function recordEvidence(
  store: AlfretStore,
  evidence: Omit<PersistedEvidence, "kind">,
): Promise<void> {
  await store.put({ kind: "evidence-record", ...evidence });
}

export async function loadEvidence(
  store: AlfretStore,
  findingCapsuleId?: string,
): Promise<PersistedEvidence[]> {
  const all = await store.list<PersistedEvidence>("evidence-record");
  return findingCapsuleId
    ? all.filter((e) => e.findingCapsuleId === findingCapsuleId)
    : all;
}
