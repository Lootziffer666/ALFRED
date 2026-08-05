// Die Demo hält absichtlich etwas zurück. Damit das sympathisch bleibt statt
// wie eine kaputte Seite zu wirken, muss der Eisberg-Abschnitt benennen, WAS
// zurückgehalten wird.
//
// Dieser Test hält die beiden Hälften zusammen: lib/profile/guards.ts setzt die
// Grenze durch, lib/report/capabilities.ts erklärt sie. Wird eine Route neu
// bewacht, ohne dass jemand sie erwähnt, schlägt er fehl — die Demo kann dann
// nicht stillschweigend mehr einbehalten, als sie zugibt.

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  ICEBERG_BELOW,
  CTA_HEADLINE,
  ctaFor,
  namedRoutes,
} from "@/lib/report/capabilities";

const API_ROOT = path.resolve(__dirname, "..", "app", "api");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** "/api/timeline/[repository]" aus "app/api/timeline/[repository]/route.ts". */
function routePathOf(file: string): string {
  return "/" + path.relative(path.resolve(API_ROOT, ".."), path.dirname(file)).split(path.sep).join("/");
}

function guardedRoutes(): string[] {
  return walk(API_ROOT)
    .filter((f) => f.endsWith("route.ts"))
    .filter((f) => {
      const src = readFileSync(f, "utf8");
      return src.includes("refuseForeignCredentials") || src.includes("refuseOutsideHomelab");
    })
    .map(routePathOf)
    .sort();
}

describe("Eisberg — was die Demo zurückhält, sagt sie auch", () => {
  it("findet überhaupt bewachte Routen (sonst prüft dieser Test nichts)", () => {
    expect(guardedRoutes().length).toBeGreaterThan(5);
  });

  it("benennt jede bewachte Route in einem Eisberg-Eintrag", () => {
    const named = namedRoutes();
    const unexplained = guardedRoutes().filter((r) => !named.has(r));

    expect(
      unexplained,
      "diese Routen hält die Demo zurück, ohne dass der Eisberg-Abschnitt sie erwähnt",
    ).toEqual([]);
  });

  it("erfindet umgekehrt keine Route, die es gar nicht gibt", () => {
    const real = new Set(
      walk(API_ROOT).filter((f) => f.endsWith("route.ts")).map(routePathOf),
    );
    const phantom = [...namedRoutes()].filter((r) => !real.has(r));

    expect(phantom, "der Eisberg nennt Routen, die im Repo nicht existieren").toEqual([]);
  });

  it("gibt zu jedem Eintrag einen Titel und eine Erklärung", () => {
    for (const item of ICEBERG_BELOW) {
      expect(item.title.length).toBeGreaterThan(3);
      expect(item.detail.length, `${item.title} hat keine Erklärung`).toBeGreaterThan(40);
    }
  });

  it("nennt die Zugangsdaten-Grenze zuerst — sie ist die, gegen die man zuerst läuft", () => {
    expect(ICEBERG_BELOW[0].routes).toContain("/api/inspect");
  });
});

describe("CTA — frech, aber ohne Bluff", () => {
  it("verspricht keine Installation, solange es keinen Installer gibt", () => {
    const cta = ctaFor({ localInstaller: false });
    expect(cta.installs).toBe(false);
    expect(cta.action).not.toMatch(/installieren/i);
  });

  it("schaltet erst um, wenn der Installer bewiesen ist", () => {
    expect(ctaFor({ localInstaller: true }).installs).toBe(true);
  });

  it("rahmt den Bericht als Aufwärmprogramm, nicht als Produkt", () => {
    expect(CTA_HEADLINE).toMatch(/Aufwärmprogramm/);
  });
});
