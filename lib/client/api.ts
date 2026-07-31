import type { ContractMap, Handoff, RepoEvidence, RepoIdentity, AcceptanceReport } from "@/lib/schema";
import type { Report, ReportMode } from "@/lib/report/modes";
import type { SignalSource } from "@/lib/report/signals";

async function postJson<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    return { ok: false, error: `Network error: ${(err as Error).message}` };
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: `Server returned an unreadable response (HTTP ${res.status}).` };
  }
  if (!res.ok) {
    const error = (json as { error?: string })?.error ?? `Request failed (HTTP ${res.status}).`;
    return { ok: false, error };
  }
  return { ok: true, data: json as T };
}

export function inspectRepo(params: { repo: string; ref?: string; token?: string }) {
  return postJson<{ evidence: RepoEvidence }>("/api/inspect", params);
}

export interface ReportResponse {
  report: Report;
  repo: RepoIdentity;
  sources: SignalSource[];
  warnings: string[];
  fetchedAt: string;
}

/** Public demo: no token is sent, by construction. */
export function generateReport(params: { repo: string; ref?: string; mode?: ReportMode; level?: 1 | 2 | 3 | 4 }) {
  return postJson<ReportResponse>("/api/report", params);
}

export function generateContractMap(params: { evidence: RepoEvidence; apiKey: string; model: string }) {
  return postJson<{ contractMap: ContractMap }>("/api/contract-map", params);
}

export function auditChange(params: {
  handoff: Handoff;
  input: { kind: "url"; url: string } | { kind: "pasted_diff"; diff: string };
  token?: string;
  agentSummary?: string;
}) {
  return postJson<{ report: AcceptanceReport }>("/api/audit", params);
}
