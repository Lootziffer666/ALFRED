// plan §29 — Schwerpunkt: Marker-Verhalten, der Etappen-Widerspruch und
// der Schleifenschutz sind die drei Stellen, an denen dieser Job real
// gefährlich oder falsch werden könnte.

import { describe, it, expect } from "vitest";
import {
  replaceMarkedBlock,
  findStaleEtappenClaim,
} from "../lib/readme/markers";
import { hasOpenProposal, jobStateId } from "../lib/daemon/jobs/job-state";

describe("replaceMarkedBlock", () => {
  const README = `# Projekt\n\n<!-- alfret:begin status -->\nAlte Info\n<!-- alfret:end status -->\n\nWeiterer Text.`;

  it("ersetzt nur den markierten Block", () => {
    const result = replaceMarkedBlock(README, "Neue Info");
    expect(result.changed).toBe(true);
    expect(result.newContent).toContain("Neue Info");
    expect(result.newContent).toContain("Weiterer Text.");
    expect(result.newContent).not.toContain("Alte Info");
  });

  it("fehlende Marker → keine Änderung, insertIfMissing=false (Default)", () => {
    const noMarkers = "# Projekt\n\nEinfacher Text ohne Marker.";
    const result = replaceMarkedBlock(noMarkers, "Neue Info");
    expect(result.changed).toBe(false);
    expect(result.newContent).toBe(noMarkers);
  });

  it("identischer Inhalt → changed:false (No-op-Commit unmöglich)", () => {
    const result = replaceMarkedBlock(README, "Alte Info");
    expect(result.changed).toBe(false);
  });

  it("insertIfMissing:true fügt neuen Block an", () => {
    const noMarkers = "# Projekt";
    const result = replaceMarkedBlock(noMarkers, "Info", { insertIfMissing: true });
    expect(result.changed).toBe(true);
    expect(result.newContent).toContain("<!-- alfret:begin status -->");
  });

  it("Prosa außerhalb der Marker bleibt unangetastet, auch falsche Behauptungen", () => {
    const readmeWithClaim = `${README}\n\nAlle 11 Etappen abgeschlossen.`;
    const result = replaceMarkedBlock(readmeWithClaim, "Neue Info");
    expect(result.newContent).toContain("Alle 11 Etappen abgeschlossen.");
  });
});

describe("findStaleEtappenClaim", () => {
  it("erkennt Widerspruch zwischen Behauptung und tatsächlicher Etappenzahl", () => {
    const readme = "# Projekt\n\nAlle 11 Etappen abgeschlossen.";
    const result = findStaleEtappenClaim(readme, 16);
    expect(result).toEqual({
      claimed: 11,
      text: "Alle 11 Etappen abgeschlossen",
    });
  });

  it("keine Behauptung im Text → null", () => {
    expect(findStaleEtappenClaim("# Projekt\n\nEinfacher Text.", 16)).toBeNull();
  });

  it("Behauptung stimmt mit tatsächlicher Zahl überein → null, kein Finding", () => {
    const readme = "Alle 16 Etappen abgeschlossen.";
    expect(findStaleEtappenClaim(readme, 16)).toBeNull();
  });
});

describe("Schleifenschutz — hasOpenProposal und jobStateId", () => {
  it("jobStateId folgt dem Format jobName@repository", () => {
    expect(jobStateId("readme-freshness", "owner/repo")).toBe(
      "readme-freshness@owner/repo",
    );
  });

  it("null-State → kein offener Vorschlag", () => {
    expect(hasOpenProposal(null)).toBe(false);
  });

  it("openPrNumber gesetzt → blockiert weitere Vorschläge", () => {
    expect(
      hasOpenProposal({
        kind: "daemon-job-state",
        id: "x",
        lastProposedForPrNumber: 5,
        openPrNumber: 5,
        updatedAt: "2026-01-01T00:00:00Z",
      }),
    ).toBe(true);
  });

  it("openPrNumber null nach Merge → wieder offen für neue Vorschläge", () => {
    expect(
      hasOpenProposal({
        kind: "daemon-job-state",
        id: "x",
        lastProposedForPrNumber: 5,
        openPrNumber: null,
        updatedAt: "2026-01-01T00:00:00Z",
      }),
    ).toBe(false);
  });
});
