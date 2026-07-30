# ALFRED — Evidence-First Repository Butler

ALFRED prepares a repository before you hand it to a coding agent, and audits
the agent's work against evidence afterward. It never converts an unproven
claim into a passed one just because someone said it was done.

This implements the vertical slice specified in [`PRD.md`](./PRD.md):

```
Choose repository
→ collect repository evidence
→ classify current state (contract map, via an OpenRouter model)
→ generate a bounded implementation handoff
→ inspect a submitted diff or pull request
→ produce an acceptance report
→ export the evidence package (Markdown / JSON)
```

## Raum VIII · Skriptorium (`/archive`)

A second, self-contained tool at [`/archive`](./app/archive/page.tsx), porting
the actual functionality of the earlier `Alfred_new.html` prototype (an
elaborate single-file mockup that shipped in this repo) into real,
tested code rather than a static mockup:

- **Client-side SQLite reader** — drag in a `.sqlite`/`.db` file (e.g. the
  `sternkarte.sqlite` or starred-repos export already in this repo) and
  Alfred inspects its schema via [sql.js](https://github.com/sql-js/sql.js)
  running entirely in the browser (`lib/sqlite/engine.ts`), guesses each
  table's role (repo source / classification / license) and column mapping,
  and lets you correct both.
- **Repo register ("Zettelkasten")** — the resulting repos are searchable,
  sortable, and can be inspected one at a time ("Einzelstern") or selected
  as a batch for archive-wide illumination ("Archiv ausleuchten").
- **Rule-based evidence extraction** (`lib/atoms/`) — a fixed set of
  regex-backed rules turn README/constitution/tree/commit/convention text
  into evidence-backed "atoms," each carrying its own literary "trope" at
  four tonal "illumination levels" (I–IV). Nothing is asserted without a
  matched rule and its evidence.
- **CUE-audited report composition** — a deterministic fallback report
  always shows only what's backed by atoms. An optional KI-Setzer step
  sends the same atoms to a user-configured OpenAI-compatible endpoint
  (OpenRouter, or a local Ollama/LM-Studio/vLLM instance) **directly from
  the browser** — not through this app's server, so a local endpoint like
  `http://localhost:11434/v1` actually works — and every sentence the model
  returns is parsed for `[[atom_id]]` / `[[?HYP: ...]]` tags and classified
  as backed, hypothesis, or contradicted (an unbeloved tag with no matching
  atom), never taken on faith.
- **SVG relationship map** and a plain-text/3D-spec export, both derived
  from the same atom list as the report.

This area intentionally does not reuse the PRD's OpenRouter server adapter:
local-endpoint support requires the call to originate in the user's own
browser, not this app's server.

## Stack

- TypeScript (strict), React 19, Next.js 16 App Router
- Bun as package manager and script runner
- Zod for runtime validation of model output and API request bodies
- Vitest + React Testing Library for tests
- No database — session state lives in memory in the browser tab

## Setup

```bash
bun install
bun run dev       # http://localhost:3000
```

No environment variables are required (see `.env.example`). GitHub tokens and
OpenRouter API keys are entered directly in the app and sent only to this
app's own route handlers for the duration of a single request; they are
never written to disk, logs, or Git.

## Scripts

```bash
bun run dev         # start the dev server
bun run build       # production build
bun run start       # run the production build
bun run typecheck   # tsc --noEmit
bun run lint        # eslint
bun run test        # vitest run
```

## Demo mode

Check "Demo mode" on the session-setup screen to walk the entire workflow —
inventory, a seven-finding contract map covering all six finding statuses, an
editable handoff, and an acceptance report with both a passed and a
not-proven criterion plus a flagged unsupported agent claim — without any
network access or credentials. Demo mode runs through the same
`buildHandoffDraft` / `buildAcceptanceReport` logic as a live session (see
`lib/demo/fixtures.ts`); it is not a separate static mockup.

## Architecture

```
lib/
  schema/          Zod schemas + inferred types: evidence, contract map,
                   handoff, acceptance report, session export
  github.ts        GitHub adapter: repo normalization, evidence collection,
                   PR/compare/diff parsing. All GitHub REST calls live here.
  openrouter.ts    OpenRouter adapter: OpenAI-compatible chat-completions
                   call, isolated from any specific model.
  contractMap.ts   Prompt construction + response validation for the
                   contract map (the only place that talks to a model for
                   classification).
  handoff.ts       Deterministic (no model call) handoff generation from
                   user-selected findings, so unknowns stay unknowns.
  audit.ts         Deterministic, network-free classification of a diff
                   against acceptance criteria. Testable without a model or
                   network — see tests/audit.test.ts.
  export.ts        Markdown/JSON session export, secrets excluded by
                   construction (SessionExport never carries a token/key).
  demo/fixtures.ts Deterministic demo data, computed through the real
                   handoff/audit logic rather than hand-typed results.
  client/api.ts    Thin fetch wrappers the UI uses to call this app's own
                   route handlers.
  atoms/           Raum VIII: rule data (data.ts), extraction (extract.ts),
                   and CUE-audited report composition (compose.ts) — all
                   pure/network-free and unit tested.
  sqlite/          Raum VIII: client-only sql.js loader + schema/role
                   guessing + repo-register builder (engine.ts).

app/
  api/inspect/          Route handler: normalize + fetch repository evidence.
  api/contract-map/     Route handler: call OpenRouter, validate the result.
  api/audit/            Route handler: resolve a PR/compare/pasted diff and
                        classify it against a handoff.
  page.tsx              The single-page app shell (session setup → inventory
                        → contract map → handoff → audit).
  archive/page.tsx       Raum VIII · Skriptorium: the SQLite-driven archive
                        tool described above.

components/
  session/SessionContext.tsx  In-memory session state (React context) shared
                              across steps so navigating between them doesn't
                              lose loaded evidence or edits.
  screens/*                   One component per required screen (PRD §6).
  archive/*                   UI for Raum VIII (drop zone, schema cards,
                              repo register, SVG map, report view, CUE
                              tooltip) plus its useArchive() state hook.
```

Provider access (GitHub, OpenRouter) is isolated behind `lib/github.ts` and
`lib/openrouter.ts`; nothing in `components/` calls `fetch` against a
third-party API directly — everything goes through this app's own route
handlers in `app/api/*`, which is also where secrets are handled and never
logged.

## Security notes

- Repository documentation (README/PLAN/AGENTS/docs) is sent to the model
  wrapped in an explicit "untrusted data" delimiter with an instruction to
  never treat it as a command — see the system prompt in `lib/contractMap.ts`.
- The app never writes to the inspected repository and never creates, merges,
  or closes anything on GitHub.
- `SessionExport` (what gets exported) has no field for tokens or API keys,
  so there is no code path that could leak one into an export.

## Known limitations

- The contract map (§5.4) requires a live OpenRouter call; it cannot be
  exercised in an offline test, which is why it's isolated behind
  `generateContractMap`/`validateContractMapResponse` and the latter is unit
  tested with fixture model output instead.
- The diff-vs-criteria classifier in `lib/audit.ts` is a deterministic
  keyword/file-overlap heuristic, not a formal proof system — it is
  intentionally conservative (defaults to `not_proven`) rather than
  optimistic, in keeping with the product's evidence-first goal.
- Open-issue counts fall back to `open_issues_count - open PR count` when the
  GitHub pulls endpoint is unavailable, which is noted as a warning in the
  inventory rather than presented as an exact number.

See `IMPLEMENTATION_REPORT.md` for what was built, what was run, and the
results.
