import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { extract } from "@/lib/atoms/extract";
import { EMPTY_SIGNALS, LEVELS, SHADED_SIGNALS, WARN } from "@/lib/atoms/data";
import { REPORT_SECTIONS, isEmpty, sectionSpec } from "@/lib/report/structure";
import { REPORT_MODES, REPORT_MODE_IDS, implementedModes, isReportMode } from "@/lib/report/modes";
import { UnimplementedReportModeError, composeReport } from "@/lib/report/compose";
import type { Report } from "@/lib/report/modes";
import type { ReportSectionKey } from "@/lib/report/structure";

const REPO = { owner: "Lootziffer666", name: "SHADED", ref: "main" };
const now = () => new Date("2026-07-31T00:00:00.000Z");

function build(level: 1 | 2 | 3 | 4 = 1, signals = SHADED_SIGNALS): Report {
  return composeReport("pruefbericht", { atoms: extract(signals), signals, level, repo: REPO, now });
}

function buildAs(mode: "pruefbericht" | "biografie" | "roast", signals = SHADED_SIGNALS): Report {
  return composeReport(mode, { atoms: extract(signals), signals, level: 4, repo: REPO, now });
}

function section(report: Report, key: ReportSectionKey) {
  const found = report.sections.find((s) => s.key === key);
  if (!found) throw new Error(`section ${key} missing from report`);
  return found;
}

function allParagraphs(report: Report) {
  return report.sections.flatMap((s) => s.blocks.flatMap((b) => b.paragraphs));
}

describe("canonical report structure", () => {
  it("declares the fifteen sections of the plan in order", () => {
    expect(REPORT_SECTIONS).toHaveLength(15);
    expect(REPORT_SECTIONS.map((s) => s.order)).toEqual([...Array(15)].map((_, i) => i + 1));
  });

  it("always emits every section, so nothing is silently dropped", () => {
    const report = build();
    expect(report.sections.map((s) => s.key)).toEqual(REPORT_SECTIONS.map((s) => s.key));
  });

  it("gives every empty section a stated reason instead of implying nothing was found", () => {
    const report = build();
    for (const s of report.sections) {
      if (isEmpty(s)) expect(s.emptyReason, `${s.key} is empty without a reason`).toBeTruthy();
    }
  });

  it("rejects an unknown section key", () => {
    expect(() => sectionSpec("nope" as ReportSectionKey)).toThrow(/Unknown report section/);
  });
});

describe("report modes", () => {
  it("types exactly the three modes of the plan", () => {
    expect(REPORT_MODE_IDS.sort()).toEqual(["biografie", "pruefbericht", "roast"]);
    expect(isReportMode("pruefbericht")).toBe(true);
    expect(isReportMode("prüfbericht")).toBe(false);
  });

  it("offers all three modes now that each one composes", () => {
    expect(implementedModes().map((m) => m.id).sort()).toEqual(["biografie", "pruefbericht", "roast"]);
  });

  it("refuses to compose a mode that is only planned, rather than faking one", () => {
    const spec = REPORT_MODES.roast;
    const original = spec.status;
    spec.status = "planned";
    try {
      expect(() => composeReport("roast", { atoms: extract(SHADED_SIGNALS), level: 1, repo: REPO, now })).toThrow(
        UnimplementedReportModeError,
      );
    } finally {
      spec.status = original;
    }
  });

  it("shows the serious reading in every mode", () => {
    for (const spec of implementedModes()) {
      expect(spec.sections).toContain("surprising-strengths");
      expect(spec.sections).toContain("donor-fit");
      expect(spec.sections).toContain("evidence");
    }
  });

  it("leaves sections outside the mode's remit empty and says so", () => {
    const report = build();
    const owned = new Set<string>(REPORT_MODES.pruefbericht.sections);
    for (const s of report.sections) {
      if (!owned.has(s.key)) {
        expect(s.blocks).toEqual([]);
        expect(s.emptyReason).toMatch(/Nicht Teil des Modus/);
      }
    }
  });
});

describe("Prüfbericht", () => {
  it("composes without a model or network", () => {
    const report = build();
    expect(report.mode).toBe("pruefbericht");
    expect(allParagraphs(report).length).toBeGreaterThan(0);
  });

  it("opens and closes on the selected tone level and carries its warning", () => {
    for (const level of [1, 2, 3, 4] as const) {
      const report = build(level);
      const opening = section(report, "opening").blocks[0];
      expect(opening.paragraphs.map((p) => p.text)).toEqual([LEVELS[level].open, LEVELS[level].turn]);

      const contradictions = section(report, "contradictions").blocks[0];
      expect(contradictions.paragraphs[0].text).toBe(LEVELS[level].close);
      expect(contradictions.warn).toBe(WARN[level]);
    }
  });

  it("backs every factual paragraph with atom evidence", () => {
    const report = build();
    const factual = allParagraphs(report).filter((p) => p.cls === "cue-ok");
    expect(factual.length).toBeGreaterThan(0);
    for (const p of factual) {
      expect(p.evidence.length, `"${p.text.slice(0, 48)}…" has no evidence`).toBeGreaterThan(0);
      expect(p.tags.every((t) => t.kind === "ok")).toBe(true);
    }
  });

  it("names only atoms that were actually extracted", () => {
    const report = build();
    const extracted = new Set(extract(SHADED_SIGNALS).map((a) => a.id));
    // Backed paragraphs cite an atom id; hypothesis tags carry a basis instead,
    // which is exactly why they are not claims about the repository.
    const cited = allParagraphs(report)
      .filter((p) => p.cls === "cue-ok")
      .flatMap((p) => p.tags.map((t) => t.label));

    expect(cited.length).toBeGreaterThan(0);
    for (const label of cited) expect(extracted.has(label), `${label} is not an extracted atom`).toBe(true);
  });

  it("routes atoms to the section their category belongs to", () => {
    const report = build();
    const atomsById = new Map(extract(SHADED_SIGNALS).map((a) => [a.id, a]));

    const quirks = section(report, "technical-quirks").blocks.flatMap((b) => b.paragraphs);
    for (const p of quirks) {
      const atom = atomsById.get(p.tags[0].label)!;
      expect(["causality", "epistemic"]).toContain(atom.cat);
    }

    const institutional = section(report, "institutional-oddities").blocks.flatMap((b) => b.paragraphs);
    for (const p of institutional) {
      const atom = atomsById.get(p.tags[0].label)!;
      expect(["authority", "adjudication"]).toContain(atom.cat);
    }

    expect(quirks.length + institutional.length).toBe(atomsById.size);
  });

  it("keeps the facts stable while the tone changes across levels", () => {
    const factsFor = (level: 1 | 2 | 3 | 4) =>
      allParagraphs(build(level))
        .flatMap((p) => p.evidence.map((e) => `${e.k}:${e.v}`))
        .sort();

    expect(factsFor(2)).toEqual(factsFor(1));
    expect(factsFor(3)).toEqual(factsFor(1));
    expect(factsFor(4)).toEqual(factsFor(1));

    const proseFor = (level: 1 | 2 | 3 | 4) => allParagraphs(build(level)).map((p) => p.text);
    expect(proseFor(2)).not.toEqual(proseFor(1));
  });

  it("states no findings at all when no rule matched", () => {
    const report = build(1, EMPTY_SIGNALS);
    expect(report.atomIds).toEqual([]);

    for (const key of ["technical-quirks", "institutional-oddities", "evidence"] as const) {
      const s = section(report, key);
      expect(isEmpty(s), `${key} invented content without atoms`).toBe(true);
      expect(s.emptyReason).toBeTruthy();
    }

    // The tone frame still renders, but it asserts nothing about the repository.
    expect(allParagraphs(report).every((p) => p.cls === "cue-notag")).toBe(true);
  });

  it("lists each backed atom once in the evidence section", () => {
    const report = build();
    const evidence = section(report, "evidence").blocks[0].paragraphs;
    const backed = extract(SHADED_SIGNALS).filter((a) => a.evidence.length > 0);
    expect(evidence).toHaveLength(backed.length);
    expect(evidence.map((p) => p.tags[0].label).sort()).toEqual(backed.map((a) => a.id).sort());
  });
});

describe("no second composer engine", () => {
  const source = readFileSync(path.resolve(__dirname, "../lib/report/compose.ts"), "utf8");

  it("delegates sentence and tone rendering to the atom engine", () => {
    expect(source).toMatch(/from "\.\.\/atoms\/compose"/);
    expect(source).toMatch(/metaOrTrope/);
    expect(source).toMatch(/from "\.\.\/atoms\/data"/);
  });

  it("does not reimplement CUE tag parsing or prompt building", () => {
    expect(source, "compose.ts must not parse atom tags itself").not.toContain("[[");
    expect(source, "compose.ts must not emit prompt directives itself").not.toContain("WARNHINWEIS");
    expect(source).not.toMatch(/function\s+(parseKI|buildPrompts|composeFallback)/);
  });
});

describe("facts survive the tone (all modes)", () => {
  it("renders a byte-identical evidence section in every mode", () => {
    const evidenceOf = (mode: "pruefbericht" | "biografie" | "roast") =>
      buildAs(mode).sections.find((s) => s.key === "evidence")!.blocks;

    expect(evidenceOf("biografie")).toEqual(evidenceOf("pruefbericht"));
    expect(evidenceOf("roast")).toEqual(evidenceOf("pruefbericht"));
  });

  it("derives the same assessment regardless of mode", () => {
    const a = buildAs("pruefbericht").assessment;
    expect(buildAs("biografie").assessment).toEqual(a);
    expect(buildAs("roast").assessment).toEqual(a);
  });
});

describe("Repo-Biografie", () => {
  it("fills the two biography sections from the repository's own words", () => {
    const report = buildAs("biografie");
    const former = report.sections.find((s) => s.key === "former-identity")!;
    const outcome = report.sections.find((s) => s.key === "actual-outcome")!;

    expect(isEmpty(former)).toBe(false);
    expect(isEmpty(outcome)).toBe(false);
    for (const p of [...former.blocks, ...outcome.blocks].flatMap((b) => b.paragraphs)) {
      expect(p.evidence.length).toBeGreaterThan(0);
    }
  });

  it("marks an inference as a hypothesis and names its basis", () => {
    const hypotheses = buildAs("biografie")
      .sections.flatMap((s) => s.blocks.flatMap((b) => b.paragraphs))
      .filter((p) => p.cls === "cue-hyp");

    expect(hypotheses.length).toBeGreaterThan(0);
    for (const p of hypotheses) {
      expect(p.tags[0].kind).toBe("hyp");
      expect(p.tags[0].label.length).toBeGreaterThan(10);
    }
  });

  it("does not carry the atom-driven quirk sections", () => {
    const report = buildAs("biografie");
    for (const key of ["technical-quirks", "institutional-oddities"] as const) {
      expect(report.sections.find((s) => s.key === key)!.emptyReason).toMatch(/Nicht Teil des Modus/);
    }
  });
});

describe("Roast", () => {
  it("leads with the findings about who gets to decide", () => {
    const institutional = buildAs("roast").sections.find((s) => s.key === "institutional-oddities")!;
    const atomsById = new Map(extract(SHADED_SIGNALS).map((a) => [a.id, a]));
    const cats = institutional.blocks
      .flatMap((b) => b.paragraphs)
      .map((p) => atomsById.get(p.tags[0].label)!.cat);

    const lastAuthority = cats.lastIndexOf("authority");
    const firstAdjudication = cats.indexOf("adjudication");
    expect(lastAuthority).toBeGreaterThanOrEqual(0);
    expect(firstAdjudication).toBeGreaterThan(lastAuthority);
  });

  it("adds a counted sting to a lopsided repository", () => {
    const contradictions = buildAs("roast").sections.find((s) => s.key === "contradictions")!;
    const sting = contradictions.blocks[0].paragraphs.find((p) => p.tags[0]?.label === "roast_sting");
    expect(sting).toBeDefined();
    expect(sting!.evidence.length).toBeGreaterThan(0);
    expect(sting!.text).toMatch(/\d+ von \d+ Befunden/);
  });

  it("stays silent on an ordinary repository instead of reaching for a joke", () => {
    const plain = buildAs("roast", EMPTY_SIGNALS);
    const contradictions = plain.sections.find((s) => s.key === "contradictions")!;
    expect(contradictions.blocks[0].paragraphs.some((p) => p.tags[0]?.label === "roast_sting")).toBe(false);
  });
});

describe("assessment", () => {
  it("lists capabilities that are atoms, never inventions", () => {
    const report = buildAs("pruefbericht");
    const extracted = new Set(extract(SHADED_SIGNALS).map((a) => a.id));
    expect(report.assessment.capabilities.length).toBeGreaterThan(0);
    for (const c of report.assessment.capabilities) {
      expect(extracted.has(c.atomId)).toBe(true);
      expect(c.evidence.length).toBeGreaterThan(0);
    }
  });

  it("never clears a repository for reuse while the licence is unread", () => {
    for (const signals of [SHADED_SIGNALS, EMPTY_SIGNALS]) {
      const { donor } = buildAs("pruefbericht", signals).assessment;
      expect(donor.blockers.join(" ")).toMatch(/Lizenz/);
      expect(["donor-candidate", "reference", "unclear"]).toContain(donor.role);
    }
  });

  it("marks the donor verdict as an inference, not a reading", () => {
    const donorSection = buildAs("pruefbericht").sections.find((s) => s.key === "donor-fit")!;
    expect(donorSection.blocks[0].paragraphs[0].cls).toBe("cue-hyp");
  });

  it("says it judged nothing when nothing matched", () => {
    const report = buildAs("pruefbericht", EMPTY_SIGNALS);
    expect(report.assessment.capabilities).toEqual([]);
    expect(report.assessment.donor.role).toBe("unclear");
    expect(report.assessment.headline).toMatch(/behauptet nichts/);
  });
});
