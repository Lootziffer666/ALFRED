import { describe, expect, it } from "vitest";
import { buildHandoffDraft } from "@/lib/handoff";
import { demoRepoEvidence, demoContractFindings } from "@/lib/demo/fixtures";

describe("buildHandoffDraft", () => {
  it("keeps unknowns as unknowns when no findings are selected", () => {
    const handoff = buildHandoffDraft({ evidence: demoRepoEvidence, selectedFindings: [], objective: "" });
    expect(handoff.currentVerifiedState).toMatch(/no findings were selected/i);
    expect(handoff.acceptanceCriteria.length).toBeGreaterThan(0);
  });

  it("derives acceptance criteria from gaps and contradictions, not from implemented findings", () => {
    const handoff = buildHandoffDraft({
      evidence: demoRepoEvidence,
      selectedFindings: demoContractFindings,
      objective: "Close the gaps.",
    });
    const criteriaText = handoff.acceptanceCriteria.map((c) => c.text).join(" ");
    // "implemented" and "out_of_scope" findings should not generate acceptance criteria.
    expect(criteriaText).not.toMatch(/builds via the documented/i);
    expect(criteriaText).toMatch(/discount codes/i);
  });

  it("never silently marks the objective as decided when the user left it blank", () => {
    const handoff = buildHandoffDraft({ evidence: demoRepoEvidence, selectedFindings: [], objective: "   " });
    expect(handoff.objective).toMatch(/not yet specified/i);
  });
});
