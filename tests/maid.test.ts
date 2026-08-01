import { describe, it, expect } from "vitest";
import { classifyPath, scanForTodos, scanForPlaceholders, checkLocation } from "@/lib/maid";

const AT = "2026-08-01T00:00:00.000Z";

describe("classifyPath", () => {
  it("classifies .d.ts as generated", () => {
    expect(classifyPath("lib/schema/homelab.d.ts", 100)).toBe("generated");
  });

  it("classifies .tmp as temporary", () => {
    expect(classifyPath("work/output.tmp", 100)).toBe("temporary");
  });

  it("classifies oversized log as archive-candidate", () => {
    expect(classifyPath("logs/runner.log", 2_000_000)).toBe("archive-candidate");
  });

  it("classifies CHANGELOG.md as stale", () => {
    expect(classifyPath("CHANGELOG.md", 100)).toBe("stale");
  });

  it("returns unknown for unrecognized paths", () => {
    expect(classifyPath("lib/homelab/fixtures.ts", 5000)).toBe("unknown");
  });

});

describe("scanForTodos", () => {
  it("finds a TODO comment", () => {
    const findings = scanForTodos("src/foo.ts", "// TODO: fix this later\nconst x = 1;", AT);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe("leftover-todo");
    expect(findings[0].path).toBe("src/foo.ts:1");
  });

  it("finds multiple TODOs", () => {
    const content = "// TODO: a\nconst y = 2;\n// FIXME: b";
    expect(scanForTodos("x.ts", content, AT)).toHaveLength(2);
  });

  it("returns empty for clean file", () => {
    expect(scanForTodos("src/clean.ts", "const x = 1;", AT)).toHaveLength(0);
  });

});

describe("scanForPlaceholders", () => {
  it("detects not-implemented throws", () => {
    const content = `function foo() {\n  throw new Error("not implemented");\n}`;
    const findings = scanForPlaceholders("lib/foo.ts", content, AT);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe("placeholder-detected");
  });

  it("returns empty for implemented function", () => {
    const content = `function foo() { return 42; }`;
    expect(scanForPlaceholders("lib/foo.ts", content, AT)).toHaveLength(0);
  });

});

describe("checkLocation", () => {
  it("returns null when path is under expected prefix", () => {
    expect(checkLocation("lib/maid/index.ts", "lib/maid/", AT)).toBeNull();
  });

  it("returns a finding when path is elsewhere", () => {
    const f = checkLocation("src/maid/index.ts", "lib/maid/", AT);
    expect(f).not.toBeNull();
    expect(f!.kind).toBe("wrong-location");
  });

});
