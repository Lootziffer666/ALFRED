import { describe, it, expect } from "vitest";
import {
  classifyPath,
  classifyWith,
  DEFAULT_CLASSIFY_RULES,
  rulesFromSettings,
} from "../lib/maid/rules";

describe("classifyPath — Verhaltensgleichheit (Kompatibilitätsbeweis)", () => {
  it("bun.lock wird als generated klassifiziert", () => {
    expect(classifyPath("bun.lock", 1000)).toBe("generated");
  });

  it("node_modules-Pfade sind generated", () => {
    expect(classifyPath("node_modules/foo/index.js", 500)).toBe("generated");
  });

  // "source" war nie eine FileClass — die Klasse für gewöhnlichen Quellcode
  // heißt "active" (lib/maid/types.ts), und die source-default-Regel liefert
  // genau sie.
  it("normale Quelldatei ist active", () => {
    expect(classifyPath("lib/daemon/log.ts", 800)).toBe("active");
  });

  it("große Binärdatei ist delete-candidate", () => {
    expect(classifyPath("assets/video.mp4", 6 * 1024 * 1024)).toBe(
      "delete-candidate",
    );
  });
});

describe("rulesFromSettings — Betreiber-Filter greift vor Klassifikation", () => {
  it("ignoreGlobs verstecken Pfade als 'ignored', unabhängig von anderen Regeln", () => {
    const rules = rulesFromSettings({ ignoreGlobs: ["fixtures/**"] });
    expect(classifyWith(rules, "fixtures/large.bin", 10_000_000)).toBe(
      "ignored",
    );
  });

  it("ohne ignoreGlobs verhält sich rulesFromSettings wie DEFAULT_CLASSIFY_RULES", () => {
    const rules = rulesFromSettings({});
    expect(classifyWith(rules, "lib/x.ts", 100)).toBe(
      classifyWith(DEFAULT_CLASSIFY_RULES, "lib/x.ts", 100),
    );
  });
});
