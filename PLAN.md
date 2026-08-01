# ALFRET — PLAN.md

<!-- plan §17: Canonical plan artefact. Etappe 30 parses this file. -->
<!-- Format is a contract: §N headings, Dateien: lists, status tags. -->

## §1 — Repository-Crawler (Fetch-Schicht)

Status: done

Dateien: lib/github.ts

## §2 — Evidence-Modell

Status: done

Dateien: lib/evidence.ts, lib/store/types.ts

## §3 — Corpus-Chunking und Vektorindex

Status: done

Dateien: lib/corpus/chunking.ts, lib/corpus/index.ts, lib/corpus/similarity.ts

## §4 — Atom-System (Regeln → Atome → Tropen)

Status: done

Dateien: lib/atoms/rules.ts, lib/atoms/data.ts, lib/atoms/tropes.ts

## §5 — Maid-Klassifikation

Status: done

Dateien: lib/maid/classify.ts, lib/maid/types.ts

## §6 — Repo-Maid-Report (Scan-Ausgabe)

Status: done

Dateien: lib/maid/report.ts

## §7 — Audit-Schicht (Diff-gegen-Kriterien)

Status: done

Dateien: lib/audit.ts

## §8 — Decision-Ledger

Status: done

Dateien: lib/corpus/ledger.ts

## §9 — Repair-Rules (deklariert)

Status: done

Dateien: lib/repair/rules.ts

Note: "clean-rebase" declared, implementation deferred to §32.

## §10 — Handoff-Paket

Status: done

Dateien: lib/handoff.ts

## §11 — Merge-Simulation und Refinery-Zustandsmaschine

Status: done

Dateien: lib/merge/simulation.ts, lib/merge/state.ts

## §12 — SSE-Broadcaster

Status: done

Dateien: lib/sse/broadcaster.ts, app/api/workshop/events/route.ts

## §13 — Profil-Analyser

Status: done

Dateien: lib/profile/analyzer.ts

## §14 — Runner (Ausführungsschicht)

Status: done

Dateien: runner/src/index.ts, runner/src/adapters.ts

## §15 — Demo-API und Policy

Status: done

Dateien: app/api/demo/run/route.ts, lib/demo/policy.ts

## §16 — Provenienz-Atome und Contributor-Rollen

Status: done

Dateien: lib/atoms/data.ts (multi_agent_workflow, contributor_role_asymmetry, implementation_provenance)

## §17 — Grünes Gate, PLAN.md, Store-Fabrik

Status: in-progress

Dateien: types/bun.d.ts, lib/store/factory.ts, lib/store/sqlite.ts, lib/store/memory.ts, lib/store/types.ts, lib/maid/classify.ts, lib/schema/homelab.ts, app/api/demo/run/route.ts, lib/profile/analyzer.ts, runner/src/adapters.ts, tests/fixtures/plan.ts, tests/hermes.test.ts, PLAN.md

## §18 — Konfiguration, Credentials, Scope

Status: planned

Dateien: lib/daemon/paths.ts, lib/daemon/config.ts, lib/daemon/credentials.ts, lib/daemon/scope.ts, .env.example

## §19 — Daemon-Kern (beobachtend)

Status: planned

Dateien: lib/daemon/log.ts, lib/daemon/context.ts, lib/daemon/jobs/types.ts, lib/daemon/scheduler.ts, lib/daemon/lock.ts, bin/alfret-daemon.ts, lib/daemon/jobs/maid-scan.ts

## §20 — Installation mit einem Befehl

Status: planned

Dateien: bin/alfret-install.ts, lib/daemon/install/units.ts, lib/daemon/install/plan.ts

## §21 — Status-Brücke (Daemon ↔ Next)

Status: planned

Dateien: lib/daemon/bridge.ts, app/api/daemon/ingest/route.ts, app/api/daemon/status/route.ts

## §22 — Das Tablett (Startansicht)

Status: planned

Dateien: lib/tray/types.ts, lib/tray/classify.ts, lib/tray/build.ts, app/page.tsx

## §23 — Seit letztem Besuch

Status: planned

Dateien: lib/visit/marker.ts, lib/visit/delta.ts

## §24 — Weiterarbeiten / Kontextkapsel

Status: planned

Dateien: lib/capsule/types.ts, lib/capsule/build.ts

## §25 — Intent-vs.-Result-Linse

Status: planned

Dateien: lib/intent/types.ts, lib/intent/compare.ts

## §26 — Beteiligungs- und Herkunftskarte

Status: planned

Dateien: lib/provenance/types.ts, lib/provenance/build.ts

## §27 — Schreibschicht und Dry-Run-Executor

Status: planned

Dateien: lib/github/write.ts, lib/github.ts (ghFetch extension)

## §28 — Maid-Einstellungen und .gitignore

Status: planned

Dateien: lib/maid/rules.ts, lib/maid/gitignore.ts, lib/maid/scan.ts

## §29 — README-Frische (erster echter PR)

Status: planned

Dateien: lib/daemon/jobs/readme-freshness.ts

## §30 — PLAN-Parser und PR↔Plan-Abgleich

Status: planned

Dateien: lib/plan/parse.ts, lib/plan/load.ts, lib/plan/match.ts

## §31 — Skills

Status: planned

Dateien: lib/skills/writer.ts, lib/flags/index.ts, catalog/skills/

## §32 — Branch-Pflege

Status: planned

Dateien: lib/daemon/jobs/branch-care.ts, lib/git/worker.ts

## §33 — Globale Suche, Beweisketten, Erklär-Ansichten

Status: planned

Dateien: lib/search/types.ts, lib/search/query.ts, components/evidence/EvidenceChain.tsx, lib/explain/types.ts

## §34 — Handoff-Profile, Abschlusskarte, Reparaturknopf

Status: planned

Dateien: lib/capsule/profiles.ts, lib/repair/safe-button.ts

## §35 — Architektur-Zeitmaschine

Status: planned

Dateien: components/timeline/ArchitectureTimeline.tsx

## §36 — Härtung, Audit, Dogfood

Status: planned

Dateien: lib/daemon/audit.ts, lib/glossary/index.ts, tests/planReferences.test.ts
