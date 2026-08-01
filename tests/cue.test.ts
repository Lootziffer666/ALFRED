import { describe, it, expect } from "vitest";
import { worstVerdict, buildCueReport, makeStaticCueCheck } from "@/lib/cue";

describe("worstVerdict", () => {
  it("returns not-applicable for empty list", () => {
    expect(worstVerdict([])).toBe("not-applicable");
  });

  it("failed beats everything", () => {
    expect(worstVerdict(["passed", "failed", "partially-passed"])).toBe("failed");
  });

  it("not-proven beats passed and partially-passed", () => {
    expect(worstVerdict(["passed", "not-proven", "partially-passed"])).toBe("not-proven");
  });

  it("all passed → passed", () => {
    expect(worstVerdict(["passed", "passed"])).toBe("passed");
  });
});

describe("buildCueReport", () => {
  it("sets blocksRelease=true when overall is failed", () => {
    const checks = [
      makeStaticCueCheck("regression", "failed", "Tests gebrochen"),
      makeStaticCueCheck("schema-fidelity", "passed", "OK"),
    ];
    const report = buildCueReport("t1", "p1", checks);
    expect(report.overall).toBe("failed");
    expect(report.blocksRelease).toBe(true);
  });

  it("sets blocksRelease=false when overall is passed", () => {
    const checks = [
      makeStaticCueCheck("schema-fidelity", "passed", "OK"),
      makeStaticCueCheck("scope-fidelity", "passed", "OK"),
    ];
    const report = buildCueReport("t1", "p1", checks);
    expect(report.overall).toBe("passed");
    expect(report.blocksRelease).toBe(false);
  });

  it("not-proven also blocks release", () => {
    const checks = [makeStaticCueCheck("acceptance-criteria", "not-proven", "Keine Evidence")];
    const report = buildCueReport("t1", "p1", checks);
    expect(report.blocksRelease).toBe(true);
  });
});
