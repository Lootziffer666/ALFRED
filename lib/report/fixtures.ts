import { SHADED_SIGNALS } from "../atoms/data";
import { extract } from "../atoms/extract";
import type { Signals } from "../atoms/types";
import { composeReport } from "./compose";
import { REPORT_MODES, type Report, type ReportMode, type ReportRepoRef } from "./modes";

/**
 * Demo fixtures.
 *
 * These are *illustrative signal sets*, not evidence fetched from a live
 * repository — the same status the prototype's SHADED_SIGNALS always had. They
 * exist so the report can be exercised without network access, and they are run
 * through the real extraction and composition pipeline rather than being
 * hand-written output.
 *
 * The third fixture is deliberately ordinary. A plain, well-behaved repository
 * must produce a thin report with stated gaps and no roast sting — that is the
 * check that the humour comes from proven structures and not from a template.
 */

export interface ReportFixture {
  id: string;
  label: string;
  repo: ReportRepoRef;
  signals: Signals;
  /** What this fixture is meant to demonstrate. */
  note: string;
}

const ALFRET_SIGNALS: Signals = {
  readme:
    "ALFRET bereitet ein Repository vor, bevor es an einen Coding-Agenten geht, und prüft dessen Arbeit anschließend gegen Belege. " +
    "Nichts gilt als bewiesen, nur weil es behauptet wurde. Zwei Räume: Repository-Butler und Raum VIII · Skriptorium. " +
    "Portiert aus einem früheren Single-File-Prototyp (Alfred_new.html), kein Build im Prototyp, heute Next.js.",
  const:
    "PRD.md war der bindende Implementierungsvertrag und ist heute historisch. Ein einziger Plan gilt als aktuelle Architekturentscheidung. " +
    "Availability<T> bleibt ausschließlich Abrufstatus und darf nicht als Wahrheitsstatus umgedeutet werden. " +
    "Es wird keine zweite Report-Composer-Engine gebaut. Unentscheidbares wird als not_proven ausgegeben, nicht geraten. " +
    "Eine Materialwahrheit: Report-Modi liefern Darstellung, aber verwenden denselben Atom- und Evidence-Kern.",
  tree:
    "README.md\nPRD.md\nIMPLEMENTATION_REPORT.md\napp/page.tsx\napp/report/page.tsx\napp/archive/page.tsx\n" +
    "app/api/report/route.ts\napp/api/inspect/route.ts\napp/api/audit/route.ts\n" +
    "lib/atoms/data.ts\nlib/atoms/compose.ts\nlib/atoms/extract.ts\nlib/report/modes.ts\nlib/report/compose.ts\n" +
    "lib/report/biography.ts\nlib/report/roast.ts\nlib/report/assessment.ts\nlib/audit.ts\nlib/handoff.ts\n" +
    "tests/naming.test.ts\ntests/report.test.ts\ntests/audit.test.ts",
  commits:
    "Etappe 0: rename the active system from ALFRED to ALFRET\n" +
    "Etappe 1A: canonical report structure, typed modes, Prüfbericht\n" +
    "Etappe 1B: the public /report surface\n" +
    "Build ALFRET v0.1 vertical slice per PRD.md\n" +
    "PR #4 Etappe 0 und 1A\n" +
    "Grundsatz: keine dauerhafte Doppelbenennung, keine Alias-Schicht.\n" +
    "Vertragslücke geschlossen: Evidence erweitert statt umgebaut.",
  conv:
    "Konvention: jede Tatsachenbehauptung muss auf ein Atom zurückführbar sein; Vermutetes bleibt sichtbar Hypothese. " +
    "Der Planer ruft kein Modell auf. Kein setScale-artiger Sonderweg: neue Räume folgen dem Route-Handler-Muster. " +
    "UNKNOWN, not_proven und escalated sind gültige Ergebnisse und keine zu schließenden Lücken.",
};

/** A perfectly ordinary small utility repository. Nothing to see, on purpose. */
const TINYCACHE_SIGNALS: Signals = {
  readme:
    "tinycache is a small in-memory LRU cache for Node. Install with npm, call get and set, done. " +
    "MIT licensed. Zero dependencies.",
  const: "",
  tree: "README.md\npackage.json\nsrc/index.js\nsrc/lru.js\ntest/lru.test.js\n.github/workflows/ci.yml",
  commits:
    "Bump version to 1.2.1\nFix off-by-one in eviction order\nAdd test for max size zero\nUpdate README example\nDrop Node 14 from CI",
  conv: "Conventional commits. Tests run with node --test. No build step.",
};

export const REPORT_FIXTURES: readonly ReportFixture[] = [
  {
    id: "shaded",
    label: "SHADED",
    repo: { owner: "Lootziffer666", name: "SHADED", ref: "main" },
    signals: SHADED_SIGNALS,
    note: "Das dichte Beispiel: viele Regeln, eigene Forensik, ein Orakel. Hier greift fast jede Regel.",
  },
  {
    id: "alfret",
    label: "ALFRET",
    repo: { owner: "Lootziffer666", name: "ALFRET", ref: "main" },
    signals: ALFRET_SIGNALS,
    note: "Das Werkzeug über sich selbst — inklusive der eigenen Verfassungs- und Präzedenz-Sprache.",
  },
  {
    id: "tinycache",
    label: "octo/tinycache",
    repo: { owner: "octo", name: "tinycache", ref: "main" },
    signals: TINYCACHE_SIGNALS,
    note: "Ein gewöhnliches kleines Repository. Der Bericht muss hier dünn bleiben und darf nicht witzeln.",
  },
];

export function fixtureById(id: string): ReportFixture {
  const found = REPORT_FIXTURES.find((f) => f.id === id);
  if (!found) throw new Error(`Unknown report fixture: ${id}`);
  return found;
}

/** Runs a fixture through the real pipeline — never hand-written output. */
export function fixtureReport(fixture: ReportFixture, mode: ReportMode, level?: 1 | 2 | 3 | 4): Report {
  return composeReport(mode, {
    atoms: extract(fixture.signals),
    signals: fixture.signals,
    level: level ?? REPORT_MODES[mode].defaultLevel,
    repo: fixture.repo,
    now: () => new Date("2026-07-31T00:00:00.000Z"),
  });
}
