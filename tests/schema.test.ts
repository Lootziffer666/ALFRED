import { describe, expect, it } from "vitest";
import { contractMapModelResponseSchema } from "@/lib/schema/contract";
import { validateContractMapResponse } from "@/lib/contractMap";

describe("contractMapModelResponseSchema", () => {
  it("accepts a well-formed model response", () => {
    const result = contractMapModelResponseSchema.safeParse({
      findings: [
        {
          id: "build-works",
          claim: "The build works",
          status: "implemented",
          evidenceFor: [{ source: "package.json · scripts.build" }],
          evidenceAgainst: [],
          confidence: 0.9,
          explanation: "A build script exists.",
          missingProof: null,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid status value", () => {
    const result = contractMapModelResponseSchema.safeParse({
      findings: [
        {
          id: "x",
          claim: "x",
          status: "definitely_true", // not one of the six allowed statuses
          evidenceFor: [],
          evidenceAgainst: [],
          confidence: 0.5,
          explanation: "x",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects confidence outside [0,1]", () => {
    const result = contractMapModelResponseSchema.safeParse({
      findings: [
        {
          id: "x",
          claim: "x",
          status: "unclear",
          evidenceFor: [],
          evidenceAgainst: [],
          confidence: 1.5,
          explanation: "x",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty findings array", () => {
    const result = contractMapModelResponseSchema.safeParse({ findings: [] });
    expect(result.success).toBe(false);
  });
});

describe("validateContractMapResponse", () => {
  it("parses fenced JSON emitted by a model and returns a ContractMap", () => {
    const raw = "```json\n" + JSON.stringify({
      findings: [
        {
          id: "a",
          claim: "claim",
          status: "unclear",
          evidenceFor: [],
          evidenceAgainst: [],
          confidence: 0.4,
          explanation: "explanation",
        },
      ],
    }) + "\n```";
    const result = validateContractMapResponse(raw, "test/model");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contractMap.modelId).toBe("test/model");
      expect(result.contractMap.findings).toHaveLength(1);
    }
  });

  it("returns a validation error instead of throwing on invalid JSON", () => {
    const result = validateContractMapResponse("not json at all", "test/model");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("validation");
      expect(result.raw).toBe("not json at all");
    }
  });

  it("returns a validation error when JSON is valid but schema does not match", () => {
    const result = validateContractMapResponse(JSON.stringify({ foo: "bar" }), "test/model");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe("validation");
  });
});
