import { describe, it, expect } from "vitest";
import { extract } from "@/lib/atoms/extract";
import { REPORT_FIXTURES, fixtureById, fixtureReport } from "@/lib/report/fixtures";
import { reportToHtml, reportToJson, reportToMarkdown, shareParamsOf, shareQuery } from "@/lib/report/export";
import { REPORT_MODE_IDS, type ReportMode } from "@/lib/report/modes";

const SOURCES = [
  { slot: "readme" as const, label: "README", status: "loaded" as const, paths: ["README.md"], chars: 42 },
  { slot: "const" as const, label: "Verfassungs-Dokumente", status: "skipped" as const, reason: "Keine Regel-Datei.", paths: [], chars: 0 },
];

describe("fixtures", () => {
  it("ships the three fixtures the stage calls for", () => {
    expect(REPORT_FIXTURES.map((f) => f.id)).toEqual(["shaded", "alfret", "tinycache"]);
    expect(() => fixtureById("nope")).toThrow(/Unknown report fixture/);
  });

  it("runs each fixture through the real pipeline in every mode", () => {
    for (const fixture of REPORT_FIXTURES) {
      for (const mode of REPORT_MODE_IDS) {
        const report = fixtureReport(fixture, mode);
        expect(report.mode).toBe(mode);
        expect(report.atomIds).toEqual(extract(fixture.signals).map((a) => a.id));
      }
    }
  });

  it("finds plenty in the dense fixtures", () => {
    for (const id of ["shaded", "alfret"]) {
      const report = fixtureReport(fixtureById(id), "pruefbericht");
      expect(report.atomIds.length, `${id} produced no findings`).toBeGreaterThan(3);
    }
  });

  it("stays thin and silent on the ordinary repository", () => {
    const fixture = fixtureById("tinycache");
    const roast = fixtureReport(fixture, "roast");

    // No counted imbalance, so no sting and no capability claims.
    const contradictions = roast.sections.find((s) => s.key === "contradictions")!;
    expect(contradictions.blocks[0].paragraphs.some((p) => p.tags[0]?.label === "roast_sting")).toBe(false);
    expect(roast.assessment.capabilities).toEqual([]);
    expect(roast.assessment.donor.role).not.toBe("donor-candidate");

    // And it does not silently pretend the sections are full.
    const strengths = roast.sections.find((s) => s.key === "surprising-strengths")!;
    expect(strengths.emptyReason).toBeTruthy();
  });
});

describe("export", () => {
  const report = fixtureReport(fixtureById("shaded"), "pruefbericht");
  const input = { report, sources: SOURCES, warnings: ["Tree truncated."] };

  it("writes Markdown carrying the claims, their evidence and the unknowns", () => {
    const md = reportToMarkdown(input);
    expect(md).toMatch(/^# ALFRET · Prüfbericht — Lootziffer666\/SHADED/);
    expect(md).toContain(report.assessment.headline);
    expect(md).toContain("## 13. Evidence");
    expect(md).toContain("## Was nicht beurteilt wurde");
    expect(md).toContain("Lizenz");
    expect(md).toContain("**WARNHINWEIS:**");
    expect(md).toContain("Keine Regel-Datei.");
    expect(md).toContain("Tree truncated.");
  });

  it("does not export sections the mode never rendered", () => {
    const md = reportToMarkdown(input);
    expect(md).not.toContain("2. Was dieses Repository vermutlich einmal war");
    expect(md).not.toContain("14. ALFRET-Eisberg");
  });

  it("marks a hypothesis as a hypothesis in Markdown", () => {
    const md = reportToMarkdown({ report: fixtureReport(fixtureById("shaded"), "biografie") });
    expect(md).toContain("_Hypothese:");
  });

  it("writes self-contained HTML and escapes the content", () => {
    const html = reportToHtml({
      report: fixtureReport({ ...fixtureById("shaded"), repo: { owner: "a<b", name: "c&d" } }, "pruefbericht"),
    });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<style>");
    expect(html).toContain("a&lt;b/c&amp;d");
    expect(html).not.toContain("a<b/c&d");
  });

  it("writes JSON that round-trips", () => {
    const parsed = JSON.parse(reportToJson(input));
    expect(parsed.report.atomIds).toEqual(report.atomIds);
    expect(parsed.sources).toHaveLength(2);
    expect(parsed.warnings).toEqual(["Tree truncated."]);
  });
});

describe("share link", () => {
  it("carries only what is needed to rebuild the run", () => {
    const report = fixtureReport(fixtureById("shaded"), "roast", 3);
    expect(shareParamsOf(report)).toEqual({
      repo: "Lootziffer666/SHADED",
      ref: "main",
      mode: "roast" satisfies ReportMode,
      level: 3,
    });

    const query = shareQuery(report);
    expect(query).toBe("?repo=Lootziffer666%2FSHADED&mode=roast&level=3&ref=main");
    expect(query).not.toContain("Amtsarzt");
  });

  it("omits a ref that was never pinned", () => {
    const fixture = fixtureById("tinycache");
    const report = fixtureReport({ ...fixture, repo: { owner: "octo", name: "tinycache" } }, "pruefbericht");
    expect(shareQuery(report)).not.toContain("ref=");
  });
});
