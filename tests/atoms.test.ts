import { describe, expect, it } from "vitest";
import { extract, buildMetaAtoms } from "@/lib/atoms/extract";
import { RULES, SHADED_SIGNALS, EMPTY_SIGNALS } from "@/lib/atoms/data";
import { parseKI, mapSectionsToPhases, composeFallback, buildPrompts, metaOrTrope } from "@/lib/atoms/compose";
import type { Atom } from "@/lib/atoms/types";

describe("extract", () => {
  it("returns no atoms for empty signals", () => {
    expect(extract(EMPTY_SIGNALS)).toEqual([]);
  });

  it("finds evidence-backed atoms in the SHADED demo signals", () => {
    const atoms = extract(SHADED_SIGNALS);
    const ids = atoms.map((a) => a.id);
    expect(ids).toContain("single_file");
    expect(ids).toContain("constitution");
    expect(ids).toContain("unknown");
    // Every returned atom must carry at least one piece of evidence — never an
    // empty claim.
    for (const a of atoms) {
      expect(a.evidence.length).toBeGreaterThan(0);
      expect(a.hyp).toBe(false);
    }
  });

  it("never invents a rule id that isn't in RULES", () => {
    const atoms = extract(SHADED_SIGNALS);
    const knownIds = new Set(RULES.map((r) => r.id));
    for (const a of atoms) expect(knownIds.has(a.id)).toBe(true);
  });
});

describe("buildMetaAtoms", () => {
  it("aggregates per-repo counts into archive-wide percentages", () => {
    const atoms = buildMetaAtoms({ counts: { single_file: 3 }, samples: { single_file: ["repo-a", "repo-b"] }, total: 10 });
    expect(atoms).toHaveLength(1);
    expect(atoms[0].count).toBe(3);
    expect(atoms[0].pct).toBe(30);
    expect(atoms[0].metaSentence).toMatch(/30%/);
    expect(atoms[0].metaSentence).toMatch(/repo-a/);
  });
});

describe("composeFallback", () => {
  it("places every rule's atom assigned to a mid phase into the fallback text (nothing silently dropped)", () => {
    // The "schein" (open) and "quint" (close) phases always show the fixed
    // level narration, not atom tropes — only the three middle phases
    // (verfass/behörd/para) render their picked atoms' tropes. That covers
    // every rule id except "single_file", which the original prototype's
    // phase layout assigns only to "schein".
    const atoms = extract(SHADED_SIGNALS).filter((a) => a.id !== "single_file");
    const phases = composeFallback({ atoms, level: 2, mode: "single", metaTotal: 0, dbFileNames: [], assess: null });
    expect(phases).toHaveLength(5);
    const shownIds = new Set(phases.flatMap((p) => p.paragraphs.map((par) => par.text)));
    for (const a of atoms) {
      const trope = metaOrTrope(a, 2, "single");
      expect(shownIds.has(trope)).toBe(true);
    }
  });

  it("marks a phase with no matching atoms as empty rather than fabricating text", () => {
    const phases = composeFallback({ atoms: [], level: 1, mode: "single", metaTotal: 0, dbFileNames: [], assess: null });
    const verfassPhase = phases.find((p) => p.title === "Die Verfassung");
    expect(verfassPhase?.empty).toBe(true);
  });
});

describe("buildPrompts", () => {
  it("includes every atom's id as a citable tag and never leaks raw evidence as a fact outside the atom block", () => {
    const atoms = extract(SHADED_SIGNALS);
    const { system } = buildPrompts({ atoms, level: 2, mode: "single", signals: SHADED_SIGNALS, assess: null });
    for (const a of atoms) expect(system).toContain(`[[${a.id}]]`);
    expect(system).toMatch(/HARTE REGELN/);
  });
});

describe("parseKI (CUE audit)", () => {
  const atoms: Atom[] = [
    { id: "single_file", cat: "authority", evidence: [{ k: "README", v: "single file" }], trope: { 1: "a", 2: "b", 3: "c", 4: "d" }, hyp: false },
  ];

  it("classifies a paragraph citing a real atom as cue-ok and counts it", () => {
    const text = "## Der Schein der Oberfläche\nEin belegter Satz. [[single_file]]\n## Quintessenz\nEnde. WARNHINWEIS: Vorsicht.";
    const { sections, kiCount, badCount, unused } = parseKI(text, atoms);
    const first = sections[0].paragraphs[0];
    expect(first.cls).toBe("cue-ok");
    expect(first.tags[0]).toEqual({ label: "single_file", kind: "ok" });
    expect(kiCount).toBe(1);
    expect(badCount).toBe(0);
    expect(unused).toHaveLength(0);
  });

  it("classifies a paragraph citing an unknown tag as cue-bad and counts a contradiction", () => {
    const text = "## Die Verfassung\nEin unbelegter Satz. [[nonexistent_atom]]";
    const { sections, badCount } = parseKI(text, atoms);
    expect(sections[0].paragraphs[0].cls).toBe("cue-bad");
    expect(badCount).toBe(1);
  });

  it("classifies a hypothesis tag as cue-hyp without a contradiction", () => {
    const text = "## Die Verfassung\nEine Vermutung. [[?HYP: unklar]]";
    const { sections, badCount, kiCount } = parseKI(text, atoms);
    expect(sections[0].paragraphs[0].cls).toBe("cue-hyp");
    expect(badCount).toBe(0);
    expect(kiCount).toBe(1);
  });

  it("classifies an untagged paragraph as cue-notag", () => {
    const text = "## Die Verfassung\nEin Satz ganz ohne Tag.";
    const { sections } = parseKI(text, atoms);
    expect(sections[0].paragraphs[0].cls).toBe("cue-notag");
  });

  it("extracts the WARNHINWEIS line as the section's warning and excludes it from paragraphs", () => {
    const text = "## Quintessenz\nSchlusssatz. [[single_file]]\nWARNHINWEIS: Das ist die Warnung.";
    const { sections } = parseKI(text, atoms);
    expect(sections[0].warn).toBe("Das ist die Warnung.");
    expect(sections[0].paragraphs.some((p) => p.text.includes("WARNHINWEIS"))).toBe(false);
  });

  it("reports every atom the model never cited as unused", () => {
    const twoAtoms: Atom[] = [
      ...atoms,
      { id: "constitution", cat: "authority", evidence: [{ k: "x", v: "y" }], trope: { 1: "a", 2: "b", 3: "c", 4: "d" }, hyp: false },
    ];
    const text = "## Die Verfassung\nNur ein Atom zitiert. [[single_file]]";
    const { unused } = parseKI(text, twoAtoms);
    expect(unused.map((a) => a.id)).toEqual(["constitution"]);
  });
});

describe("mapSectionsToPhases", () => {
  it("maps sections to phase slots by heading keyword regardless of order", () => {
    const sections = [
      { title: "Quintessenz", paragraphs: [] },
      { title: "Der Schein der Oberfläche", paragraphs: [] },
    ];
    const mapped = mapSectionsToPhases(sections);
    expect(mapped[0]?.title).toBe("Der Schein der Oberfläche");
    expect(mapped[4]?.title).toBe("Quintessenz");
  });
});
