// plan §33 — Explain: Warum hat ein Finding existiert? Provenianz + Audits.

export interface ExplainRequest {
  findingId: string;
  repository: string;
}

export interface ExplainResult {
  title: string;
  reason: string;
  timeline: Array<{ date: string; event: string }>;
}

export async function explainFinding(
  _req: ExplainRequest,
): Promise<ExplainResult> {
  return {
    title: "Unknown Finding",
    reason: "No explanation available",
    timeline: [],
  };
}
