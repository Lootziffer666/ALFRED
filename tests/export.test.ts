import { describe, expect, it } from "vitest";
import { sessionToJson, sessionToMarkdown } from "@/lib/export";
import { demoAcceptanceReport, demoContractMap, demoHandoff, demoRepoEvidence } from "@/lib/demo/fixtures";
import type { SessionExport } from "@/lib/schema";

function makeSession(): SessionExport {
  return {
    exportedAt: new Date(0).toISOString(),
    repo: {
      owner: demoRepoEvidence.identity.owner,
      name: demoRepoEvidence.identity.name,
      ref: demoRepoEvidence.identity.ref,
      url: demoRepoEvidence.identity.url,
    },
    inventory: demoRepoEvidence,
    contractMap: demoContractMap,
    handoff: demoHandoff,
    acceptanceReport: demoAcceptanceReport,
    warnings: demoRepoEvidence.warnings,
    modelsUsed: [{ purpose: "contract-map", modelId: demoContractMap.modelId }],
  };
}

describe("session export", () => {
  it("round-trips through JSON without secrets", () => {
    const json = sessionToJson(makeSession());
    expect(json).not.toMatch(/sk-or-/i);
    expect(json).not.toMatch(/ghp_/i);
    const parsed = JSON.parse(json);
    expect(parsed.repo.owner).toBe("octo");
    expect(parsed.contractMap.findings).toHaveLength(demoContractMap.findings.length);
  });

  it("produces markdown containing the key sections", () => {
    const md = sessionToMarkdown(makeSession());
    expect(md).toMatch(/# ALFRED session export/);
    expect(md).toMatch(/## Repository inventory/);
    expect(md).toMatch(/## Contract map/);
    expect(md).toMatch(/## Agent handoff/);
    expect(md).toMatch(/## Acceptance report/);
    expect(md).toMatch(/Unsupported agent claims/);
  });
});
