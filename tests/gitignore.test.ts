// plan §28 — Fixture ist die eigene .gitignore: node_modules, .next, .env,
// !.env.example, !.yarn/patches, *.tsbuildinfo.

import { describe, it, expect } from "vitest";
import {
  parseGitignore,
  isIgnored,
  globToRegExp,
} from "../lib/maid/gitignore";

const OWN_GITIGNORE = `
# deps
node_modules/
.next/
.env
!.env.example
.yarn/patches
!.yarn/patches
*.tsbuildinfo
`;

describe("gitignore — eigene Fixture", () => {
  const rules = parseGitignore(OWN_GITIGNORE);

  it("node_modules/ ist dir-only und ignoriert Verzeichnisinhalte", () => {
    expect(isIgnored("node_modules/foo/index.js", rules)).toBe(true);
  });

  it(".env ist ignoriert", () => {
    expect(isIgnored(".env", rules)).toBe(true);
  });

  it(".env.example wird durch Negation wieder unignoriert (die klassische Falle)", () => {
    expect(isIgnored(".env.example", rules)).toBe(false);
  });

  it("*.tsbuildinfo matched an beliebiger Stelle", () => {
    expect(isIgnored("lib/tsconfig.tsbuildinfo", rules)).toBe(true);
  });

  it("last-match-wins: erneute Negation nach Wildcard greift", () => {
    expect(isIgnored(".yarn/patches", rules)).toBe(false);
  });

  it("normale Quelldatei ist nicht ignoriert", () => {
    expect(isIgnored("lib/daemon/scheduler.ts", rules)).toBe(false);
  });
});

describe("globToRegExp", () => {
  it("** matched über Verzeichnisgrenzen hinweg", () => {
    const re = globToRegExp("lib/**/test.ts");
    expect(re.test("lib/a/b/test.ts")).toBe(true);
  });

  it("Anker (führendes /) bindet an die Wurzel", () => {
    const re = globToRegExp("/README.md");
    expect(re.test("README.md")).toBe(true);
    expect(re.test("sub/README.md")).toBe(false);
  });
});
