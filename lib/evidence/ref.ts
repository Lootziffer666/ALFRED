// plan §33 — Evidence References: stabile Verweise auf Beobachtungen.

export interface EvidenceRef {
  kind: "observation" | "recommendation" | "decision";
  id: string;
  repository: string;
  observedAt: string;
  detail: string;
}

export interface EvidenceChain {
  root: EvidenceRef;
  related: EvidenceRef[];
  explanation: string;
}

export function createEvidenceRef(
  kind: "observation" | "recommendation" | "decision",
  id: string,
  repository: string,
  detail: string,
): EvidenceRef {
  return {
    kind,
    id,
    repository,
    observedAt: new Date().toISOString(),
    detail,
  };
}

export function linkEvidence(root: EvidenceRef, related: EvidenceRef[]): EvidenceChain {
  return {
    root,
    related,
    explanation: "",
  };
}
