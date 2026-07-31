import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Etappe 0 guard: ALFRET is the canonical product name. There is no permanent
 * alias layer and no active double-naming — every remaining legacy hit in the
 * active source tree must be a justifiable historical reference, listed below.
 */

const ROOT = path.resolve(__dirname, "..");

/** Directories and single files that make up the *active* system. */
const SCANNED_DIRS = ["app", "components", "lib"];
const SCANNED_FILES = [
  "package.json",
  "README.md",
  ".env.example",
  "next.config.ts",
  "vitest.config.ts",
  "eslint.config.mjs",
  "tsconfig.json",
];

/**
 * The only justifiable legacy hits: the historical single-file prototype the
 * Skriptorium was ported from. It is referenced by its real, unchangeable
 * filename, and both sites label it as an earlier prototype.
 */
const HISTORICAL_ALLOWLIST: { file: string; needle: string }[] = [
  { file: "README.md", needle: "the earlier `Alfred_new.html` prototype" },
  { file: "lib/atoms/data.ts", needle: "(Alfred_new.html)." },
  // Not a product name: the GitHub repository still carries the old name, so
  // this is the address that actually resolves today. It moves when the
  // repository is renamed (the one manual step of Etappe 0).
  { file: "lib/report/capabilities.ts", needle: "https://github.com/Lootziffer666/ALFRED#readme" },
];

/** Historical documents kept verbatim; each must carry a historical banner. */
const HISTORICAL_DOCS = [
  "PRD.md",
  "alfred_PRD.md",
  "IMPLEMENTATION_REPORT.md",
  "markDown1785242252027.md",
];

const LEGACY = /alfred/i;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function activeSourceFiles(): string[] {
  const fromDirs = SCANNED_DIRS.flatMap((d) => walk(path.join(ROOT, d)));
  const fromFiles = SCANNED_FILES.map((f) => path.join(ROOT, f));
  return [...fromDirs, ...fromFiles]
    .filter((f) => !/\.(ico|png|jpg|svg|woff2?|wasm)$/i.test(f))
    .map((f) => path.relative(ROOT, f));
}

function legacyHits(): { file: string; line: number; text: string }[] {
  const hits: { file: string; line: number; text: string }[] = [];
  for (const rel of activeSourceFiles()) {
    const content = readFileSync(path.join(ROOT, rel), "utf8");
    content.split("\n").forEach((text, i) => {
      if (LEGACY.test(text)) hits.push({ file: rel, line: i + 1, text: text.trim() });
    });
  }
  return hits;
}

describe("canonical naming migration (ALFRET)", () => {
  it("names the package alfret", () => {
    const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
    expect(pkg.name).toBe("alfret");
  });

  it("uses ALFRET in the page metadata title", () => {
    const layout = readFileSync(path.join(ROOT, "app/layout.tsx"), "utf8");
    expect(layout).toMatch(/title:\s*"ALFRET/);
  });

  it("leaves no unexplained legacy names in the active source tree", () => {
    const unexplained = legacyHits().filter(
      (hit) =>
        !HISTORICAL_ALLOWLIST.some(
          (allowed) => allowed.file === hit.file && hit.text.includes(allowed.needle),
        ),
    );
    expect(
      unexplained.map((h) => `${h.file}:${h.line} — ${h.text}`),
      "every remaining legacy hit must be an allowlisted historical reference",
    ).toEqual([]);
  });

  it("keeps every allowlisted historical reference real, so the list cannot rot", () => {
    for (const allowed of HISTORICAL_ALLOWLIST) {
      const content = readFileSync(path.join(ROOT, allowed.file), "utf8");
      expect(content, `${allowed.file} no longer contains its allowlisted reference`).toContain(
        allowed.needle,
      );
    }
  });

  it("marks historical documents as historical rather than rewriting them", () => {
    for (const doc of HISTORICAL_DOCS) {
      const content = readFileSync(path.join(ROOT, doc), "utf8");
      expect(content.slice(0, 400), `${doc} is missing its historical banner`).toMatch(
        /Histor(ical|isches) (document|Dokument)/,
      );
    }
  });

  it("ships no permanent ALFRED-to-ALFRET alias layer", () => {
    const aliasLike = legacyHits().filter((hit) =>
      /\b(alias|legacyName|compat|deprecated)\b/i.test(hit.text),
    );
    expect(aliasLike.map((h) => `${h.file}:${h.line}`)).toEqual([]);
  });
});
