# ALFRET — Evidence-First Repository Butler



> **Status: Testphase** — Alle 11 Implementierungsetappen sind abgeschlossen.

> Das System geht jetzt in die strukturierte Testphase über.



ALFRET ist kein Repository-Report-Generator. Repository-Reports sind eine
sichtbare Nebenwirkung seines Projektverstehens. Andere Werkzeuge untersuchen
ein Repository, um einen Bericht zu schreiben. ALFRET schreibt einen Bericht,
weil es das Repository ohnehin verstehen muss.



---



## Implementierungsetappen



Alle Etappen sind abgeschlossen. ✅ = implementiert, getestet, committed.



| # | Titel | Kern | Status |
|---|-------|------|--------|
| 1 | Schema & Homelab-Typen | `lib/schema/homelab.ts` — `SignedExecutionPlan`, `AdapterStep`, `ArtifactManifest`, kanonische ALFRET-Typen | ✅ |
| 2 | Homelab-Infrastruktur | `lib/homelab/` — Discovery, Bootstrap, Admission, Memory, Signing, Scout, Planner, Runtimes, Verify, Benchmarks | ✅ |
| 3 | Projekt-Korpus | `lib/corpus/` — Dokument-Ingestion, Chunking, Vektorindex, Similarity-Search, Kontextfenster | ✅ |
| 4 | Evidence-Store & Project-Graph | `lib/evidence/`, `lib/graph/` — TruthStatus, Evidence-Einträge, Knoten/Kanten, Traversal, Widerspruchserkennung | ✅ |
| 5 | Decision-Ledger | `lib/ledger/` — unveränderliche Entscheidungseinträge, Begründungsketten, Eskalationsprotokoll | ✅ |
| 6 | ALFRET-Runner (Kern) | `runner/src/` — Bun-Prozess, ECDSA-Planverifikation, Adapter-Dispatch, lokale Policy, kein Shell-Spawn | ✅ |
| 7 | Runner-Adapter | `runner/src/adapters/` — `probe`, `ollama-install`, `model-pull`, `worktree`, `git-patch` | ✅ |
| 8 | Runner-Bootstrap-Pakete | `runner/src/bootstrap/` — Pairing-Fenster, Node-Registrierung, Modell-Rollout, Healthcheck-Endpunkt | ✅ |
| 9 | Repo Maid & Refinery | `lib/maid/`, `lib/refinery/`, `lib/health/` — Findings, Dateiklassifikation, Pflege-PR-Vorschläge, Merge-Simulation, Konfliktklassifikation, Reparaturregeln, Heartbeats, Fallbacks | ✅ |
| 10 | Hermes-Anbindung | `lib/hermes/`, `lib/supervisor/`, `lib/cue/` — Auftragsverwaltung, Sessions, Handoffs, Events, Dispatcher, Supervisor-Loop, CUE-Qualitätsnachweise | ✅ |
| 11 | Persistenz, Demo-Ausführung, Raum IX | `lib/store/`, `app/api/demo/run/`, `app/workshop/` — AlfretStore (Memory + SQLite), öffentliche Demo-Route, Werkstatt-UI, ALFRET-Namens-Migration | ✅ |



---



## Räume



| Raum | Route | Beschreibung |
|------|-------|--------------|
| Repository-Butler | `/` | Hauptwerkzeug: Inventar → Contract Map → Handoff → Audit → Export |
| Raum VIII · Skriptorium | `/archive` | SQLite-Reader, Repo-Register, Atom-Extraktion, CUE-Bericht, 3D-Karte |
| Raum IX · Werkstatt | `/workshop` | Supervisor-Loop-Status, laufende Orders, Heartbeats, CUE-Berichte, Demo-Trigger |



---



## Stack



- TypeScript (strict), React 19, Next.js 16 App Router
- Bun als Paketmanager und Gate-Ausführer
- Zod 4 für Runtime-Validierung
- Vitest 4 + React Testing Library für Tests
- SQLite (Bun-nativ) für optionale Persistenz — kein ORM, kein Migrations-Framework
- Kein dauerhafter Serverstate — Session-State lebt im Browser-Tab



---



## Setup



```bash
bun install
bun run dev       # http://localhost:3000
```



Keine Umgebungsvariablen erforderlich (siehe `.env.example`). GitHub-Token
und OpenRouter-API-Keys werden direkt in der App eingegeben und nur für die
Dauer eines einzelnen Requests an die eigenen Route-Handler weitergegeben —
sie werden nie auf Disk, in Logs oder in Git geschrieben.



---



## Scripts (Gate)



```bash
bun run dev         # Dev-Server starten
bun run build       # Produktions-Build
bun run start       # Produktions-Build starten
bun run typecheck   # tsc --noEmit
bun run lint        # ESLint
bun run test        # vitest run
```



Das vollständige Gate (läuft in dieser Reihenfolge):



```
bun install
bun run typecheck
bun run lint
bun run test
bun run build
```



---



## Demo-Ausführung



`POST /api/demo/run` führt eine vollständige Demo-Runde durch:



1. Erzeugt einen signierten Demo-Plan
2. Übergibt ihn an Hermes (`InMemoryHermesDispatcher`)
3. Führt einen statischen CUE-Check durch
4. Gibt Order + CUE-Bericht + Maid-Klassifikation zurück



Die Route ist vollständig in-process — kein Runner, kein echter Agent.
Sie demonstriert den Datenfluss: **Plan → Hermes → CUE → Bericht**.



Alternativ über die UI: `/workshop` → Repo-URL eingeben → „Starten".



### Demo-Modus (Repository-Butler)



„Demo-Modus" auf dem Session-Setup-Screen durchläuft den vollständigen
Workflow — Inventar, Contract Map, Handoff, Acceptance-Report — ohne
Netzwerkzugang oder Credentials. Läuft durch dieselbe
`buildHandoffDraft`/`buildAcceptanceReport`-Logik wie eine echte Session.



---



## ALFRET Runner



Ein schlanker Bun-Prozess, einer pro Node. Liest standardmäßig nur —
installiert nichts ohne explizites `--allow-install`.



```bash
bun runner/src/index.ts probe            # Hardware dieser Maschine ausgeben
bun runner/src/index.ts pair             # Einmaliges Pairing-Fenster öffnen
bun runner/src/index.ts                  # Server starten (nur lesen)
bun runner/src/index.ts --allow-install  # Server mit Ollama-Adapter
```



Bindet an `127.0.0.1:7717`. Erreichbarkeit von anderen Maschinen ist
Tailscales Aufgabe — kein weiterer Bind, CORS ist keine Authentifizierung.



Pläne werden von der gekoppelten ALFRET-Instanz per ECDSA über eine
kanonische Serialisierung (`lib/homelab/signing.ts`) signiert und vor
jeder Ausführung auf Signatur, Node-ID, Ablaufzeit, Nonce-Replay,
Adapter-Identität und strikte Parameter geprüft. Adapter liefern mit
dem Runner aus — ein Plan kann einen referenzieren, nie einen mitbringen.
Jeder Befehl ist ein Argument-Vektor; kein Shell-Spawn in `runner/src/`.
Die lokale Policy hat das letzte Wort.



---



## Architektur



```
lib/
  schema/          Zod-Schemas + inferierte Typen: SignedExecutionPlan,
                   AdapterStep, ArtifactManifest, Evidence, TruthStatus

  github.ts        GitHub-Adapter: Normalisierung, Evidence-Sammlung,
                   PR/Compare/Diff-Parsing. Alle GitHub-REST-Calls hier.

  openrouter.ts    OpenRouter-Adapter: OpenAI-kompatibler Chat-Completions-
                   Call, isoliert von jedem spezifischen Modell.

  contractMap.ts   Prompt-Konstruktion + Response-Validierung für die
                   Contract Map (einziger Ort mit Modell-Klassifikation).

  handoff.ts       Deterministischer (kein Modell-Call) Handoff aus
                   nutzerselegierten Findings — Unbekanntes bleibt unbekannt.

  audit.ts         Deterministisch, netzwerkfrei. Klassifikation eines Diffs
                   gegen Abnahmekriterien. Testbar ohne Modell oder Netzwerk.

  export.ts        Markdown/JSON-Session-Export — Secrets by construction
                   ausgeschlossen (SessionExport hat kein Token-/Key-Feld).

  demo/            Deterministische Demo-Daten, berechnet durch echte
                   Handoff/Audit-Logik, nicht handgetippt.

  client/          Thin fetch-Wrapper für die UI → eigene Route-Handler.

  atoms/           Raum VIII: Regeldaten, Extraktion, CUE-Bericht-
                   Komposition — alles pure/netzwerkfrei, unit-getestet.

  sqlite/          Raum VIII: Browser-seitiger sql.js-Loader + Schema-
                   und Rollen-Erkennung + Repo-Register-Builder.

  corpus/          Etappe 3: Dokument-Ingestion, Chunking, Vektorindex.

  evidence/        Etappe 4: TruthStatus, Evidence-Einträge, Audit-Trail.

  graph/           Etappe 4: Project-Graph — Knoten, Kanten, Traversal.

  ledger/          Etappe 5: Decision-Ledger — unveränderliche Einträge.

  maid/            Etappe 9: FileClass, Findings, Pflege-PR-Vorschläge.

  refinery/        Etappe 9: Merge-Simulation, Konfliktklassifikation,
                   Reparaturregeln, Merge-Guard.

  health/          Etappe 9: Heartbeats, Healthchecks, Fallback-Empfehlungen.

  hermes/          Etappe 10: HermesOrder, HermesSession, HandoffPackage,
                   Events, InMemoryHermesDispatcher.

  supervisor/      Etappe 10: Supervisor-Loop, LoopState, assessContext,
                   LoopSupervisor.

  cue/             Etappe 10: CueVerdict, CueCheckResult, CueReport,
                   worstVerdict, buildCueReport.

  store/           Etappe 11: AlfretStore-Interface, MemoryAlfretStore,
                   SqliteAlfretStore.



app/

  api/inspect/          Route: Repository-Evidence normalisieren + abrufen.

  api/contract-map/     Route: OpenRouter aufrufen, Ergebnis validieren.

  api/audit/            Route: PR/Compare/Diff gegen Handoff klassifizieren.

  api/demo/run/         Route: Demo-Runde (Plan → Hermes → CUE → Bericht).

  page.tsx              Repository-Butler (Etappen 1–5 + Demo-Modus).

  archive/page.tsx      Raum VIII · Skriptorium.

  workshop/page.tsx     Raum IX · Werkstatt (Etappe 11).



runner/

  src/index.ts          Bun-Einstiegspunkt — probe/pair/serve.

  src/adapters/         probe, ollama-install, model-pull, worktree, git-patch.

  src/bootstrap/        Pairing, Node-Registrierung, Modell-Rollout, Health.



components/

  session/              SessionContext — In-Memory-Session-State (React).

  screens/              Eine Komponente pro PRD-Screen.

  archive/              Raum VIII: Drop-Zone, Schema-Cards, Repo-Register,
                        SVG-Karte, Report-Ansicht, CUE-Tooltip.

  workshop/             Raum IX: WorkshopClient — Orders, Sessions, CUE.
```



---



## Sicherheitshinweise



- Repository-Dokumentation (README/PLAN/AGENTS/docs) wird mit einem
  expliziten „Untrusted-Data"-Delimiter an das Modell gesendet — das Modell
  bekommt die Anweisung, sie nie als Befehl zu interpretieren.
- ALFRET schreibt nie in das untersuchte Repository und erstellt, merged
  oder schließt nichts auf GitHub.
- `SessionExport` hat kein Feld für Tokens oder API-Keys — es gibt keinen
  Code-Pfad, der eines in einen Export leaken könnte.
- Pläne sind ECDSA-signiert; der Runner akzeptiert keine unsignierten Pläne.
- Kein Shell-Spawn in `runner/src/` — alle Befehle sind Argument-Vektoren.
- Zwei schreibende Agents im selben Worktree sind auf Hermes-Ebene verboten
  (`detectWorktreeConflict` in `lib/hermes/sessions.ts`).



---



## Bekannte Einschränkungen



- Die Contract Map (§5.4) benötigt einen Live-OpenRouter-Call und ist daher
  hinter `generateContractMap`/`validateContractMapResponse` isoliert;
  Unit-Tests verwenden Fixture-Modell-Output.
- Der Diff-vs-Criteria-Klassifikator in `lib/audit.ts` ist eine
  deterministische Heuristik, kein formales Beweissystem — er ist bewusst
  konservativ (Default: `not_proven`) statt optimistisch.
- `InMemoryHermesDispatcher` und `MemoryAlfretStore` verlieren ihren State
  bei einem Prozess-Neustart. `SqliteAlfretStore` ist die persistente
  Alternative — sie erfordert Bun als Runtime.
- Open-Issue-Counts fallen auf `open_issues_count - open PR count` zurück
  wenn der GitHub-Pulls-Endpunkt nicht verfügbar ist; das wird als Warnung
  im Inventar vermerkt, nicht als exakte Zahl präsentiert.



---



## Testphase



ALFRET tritt jetzt in die strukturierte Testphase ein.



**Was getestet wird:**



- Gate (`bun install → typecheck → lint → test → build`) auf CI
- Runner-Pairing und Probe gegen echte Homelab-Hardware
- Demo-Route `/api/demo/run` gegen Live-Next.js-Instanz
- Werkstatt-UI (`/workshop`) im Browser
- SQLite-Store gegen persistierten State über Neustarts
- Supervisor-Loop mit echten Plänen und echtem Hermes-Dispatcher
- Maid + Refinery gegen dieses Repository selbst



**Was noch aussteht (Etappe 12+):**



- Live-Status per Server-Sent Events in Raum IX
- Rate-Limiting auf `/api/demo/run` via Edge-Middleware
- CI-Integration (GitHub Actions Gate)
- Modell-Rollout via Runner über Tailscale-Netz
- Produktives Deployment



Siehe `IMPLEMENTATION_REPORT.md` für was gebaut, ausgeführt und gemessen wurde.
