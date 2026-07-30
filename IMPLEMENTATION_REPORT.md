# IMPLEMENTATION_REPORT.md

## Addendum: Raum VIII · Skriptorium (`/archive`)

After the PRD.md vertical slice below, a second request asked for the actual
functionality of the repo's earlier `Alfred_new.html` prototype — a large
single-file mockup — to be built into the real app rather than left as a
static demo. That prototype's `extract(signals)` function was called
throughout its script but never defined; every call site's usage (consuming
`.id`/`.cat`/`.evidence`/`.trope` identically to a `RULES` entry with
`hyp:false`) made the intent unambiguous, so `lib/atoms/extract.ts`
reconstructs it as "run every rule's `scan` and keep the ones with
evidence" — noted here since it's a reconstruction of unwritten code, not a
literal port.

What was added:

- `lib/sqlite/engine.ts` — a real, working client-side SQLite reader
  (sql.js, loaded from static assets in `public/sql-js/` rather than a CDN)
  with schema/role/column-mapping heuristics identical to the prototype's.
  Verified against the actual `sternkarte.sqlite` file already in this repo
  (515 real starred repos) via a manual Playwright click-through, not just
  synthetic fixtures.
- `lib/atoms/` — the prototype's 15 extraction rules, four "illumination
  level" voices, and CUE-audit tag parser, ported with their original German
  text preserved (the tone is the content, not incidental styling), plus the
  reconstructed `extract()`.
- `app/archive/page.tsx` and `components/archive/*` — a full second UI
  surface: drop zone, schema cards, a searchable/sortable repo register with
  single-repo vs. whole-archive modes, an illumination-level selector, a
  manual-signal-feed fallback, an SVG relationship map, the CUE-audited
  report view, and a KI-Setzer settings panel.
- A **found-and-fixed bug**: the first working version double-composed the
  report on repo selection and on archive illumination — the page called
  `press(false)` again after `selectSingleRepo`/`runArchiveIllumination`
  already set the report internally, and that second call closed over stale
  React state (the atoms from *before* the click), silently overwriting the
  correct report with the previous one. Caught by manually clicking a real
  repo in a browser and noticing the report didn't change; fixed by
  removing the redundant, stale call and trusting the hook's own internal
  `setReport`. This is exactly the kind of self-review gap the PRD tool
  above is designed to catch in *other* agents' work.

**Update**: the atmosphere (Flur room-door sidebar, dust-particle burst on
repo-card hover, ink-press pulse on report composition, falling-letter
Winkelhaken tiles, background grid/vignette/light-sweep) was initially left
out as "no functional impact." Told that was the wrong test for a tool whose
identity *is* its mood, all of it was added back — scoped under a
`.raum-viii` root class so the PRD-side butler tool (graded on plain mobile
usability) is unaffected. Two real bugs turned up while wiring this in,
both fixed:

- The room-door tooltip never appeared on hover: `.tuer` carried
  `overflow:hidden` (present in the original prototype's CSS too, so likely
  never actually visually verified there either), which clipped the
  absolutely-positioned `.tip` child along with it. Removed; the cable-glow
  detail it was meant to round stays fully contained on its own.
- The ink-pulse retrigger initially used `useEffect` + `setState` to toggle
  a `.pressing` class, which is exactly the "cascading render" pattern
  `eslint-plugin-react-hooks`'s newer rules reject. Replaced with ordinary
  state (`reportVersion`, incremented alongside every `setReport` call) used
  only as a React `key` on a dedicated pulse element — no effect involved.

**One architectural deviation from the rest of this app, deliberately**: the
KI-Setzer step here calls the user's configured endpoint directly from the
browser rather than through this app's own `/api/*` route handlers. A local
endpoint (`http://localhost:11434/v1` for Ollama) is only reachable from the
user's own machine — routing it through this Next.js server (which may run
on a different host, e.g. in this containerized environment) would silently
break the offline/local use case the prototype's own README note promised
("Offline-First"). The PRD-side contract map correctly stays server-side
because that flow has no local-endpoint requirement.

**Known limitation**: unlike the OpenRouter-backed contract map, this
KI-Setzer path was not exercised against a live model endpoint in this
session (no endpoint was available); only the deterministic fallback
composition and the CUE-audit *parsing* logic (`lib/atoms/compose.ts`) are
unit tested and were verified live in a browser.

---

## What was implemented

A runnable Next.js (App Router) + TypeScript vertical slice of ALFRED v0.1,
covering the required flow end to end:

- **Session setup** (`components/screens/SessionSetupScreen.tsx`): repo input
  (owner/repo or URL), ref, GitHub token, OpenRouter key/model, demo-mode
  toggle, explicit connection error feedback.
- **GitHub adapter** (`lib/github.ts`): real REST calls (not a placeholder) —
  repo metadata, recursive tree (with truncation/size-limit handling),
  README/PLAN/AGENTS/docs-markdown fetch with excerpt truncation,
  package.json parsing (stack + scripts + package manager detection), recent
  commits, open PRs, PR-file and compare-file fetches for the audit step, and
  a standalone unified-diff parser for the paste-a-diff path. Permission,
  rate-limit, and generic-failure states are distinguished, not collapsed
  into one generic error.
- **Inventory** (`components/screens/InventoryScreen.tsx`): renders every
  evidence category with an explicit availability badge
  (loaded/loading/unavailable-permissions/unavailable-rate-limited/failed/skipped)
  and inline warnings; never fabricates a value for missing evidence.
- **OpenRouter adapter** (`lib/openrouter.ts`) + **contract map**
  (`lib/contractMap.ts`): model-agnostic OpenAI-compatible call, requests a
  single JSON object, and validates the response against a Zod schema
  (`contractMapModelResponseSchema`) before it is used anywhere. Invalid JSON
  or a schema mismatch surfaces as a retryable error, never a crash. The
  prompt explicitly wraps repository documentation as untrusted data and
  instructs the model to ignore embedded instructions.
- **Contract map screen**: filterable by all six required statuses, shows
  confidence, missing-proof text, and evidence-for/against chips; checkbox
  selection feeds the handoff.
- **Handoff** (`lib/handoff.ts` + `components/screens/HandoffScreen.tsx`):
  deterministic, non-model-generated draft built only from the findings the
  user selected, so an unresolved gap becomes an acceptance criterion instead
  of the tool silently deciding it's fine. Fully editable (objective, current
  state, non-goals, constraints, relevant files, deliverables, acceptance
  criteria, required tests, prohibited changes, stop conditions, response
  format) before export.
- **Result audit** (`lib/audit.ts` + `components/screens/AuditScreen.tsx`):
  accepts a PR URL, a compare URL, or a pasted unified diff; classifies each
  acceptance criterion as `passed` / `partially_passed` / `failed` /
  `not_proven` / `not_applicable` using a deterministic, network-free
  heuristic (file-name + keyword overlap against the diff, with prohibited
  files always forcing `failed`). An optional "agent completion summary"
  field is checked against the diff and flagged in "Unsupported agent claims"
  whenever it asserts completion for a criterion that isn't `passed`.
- **Export** (`lib/export.ts`): Markdown and JSON, both generated from a
  `SessionExport` type that structurally has no field for a token or API
  key — there is no code path that could leak one into an export.
- **Demo mode** (`lib/demo/fixtures.ts`): a full session (7 findings covering
  all 6 statuses, a handoff, a diff, and an acceptance report with a
  `passed`, two `partially_passed`, and a `not_proven` criterion plus one
  flagged unsupported claim) computed by calling the real
  `buildHandoffDraft`/`buildAcceptanceReport` functions against hand-authored
  evidence — not a hand-typed fake result — so demo mode exercises the real
  logic.
- **Mobile**: single-column layout, 44px-minimum touch targets, horizontally
  scrollable step nav and tables (never the page itself), tested at a 375px
  viewport with Playwright (see below) — no required horizontal page scroll,
  no off-screen traps.

## What remains incomplete / out of scope

- **No live end-to-end run against a real GitHub repository or a real
  OpenRouter key.** This environment had outbound network access to
  `api.github.com`, so the GitHub adapter could plausibly be smoke-tested
  live, but no OpenRouter key was available to exercise the contract-map
  call end to end. The GitHub and OpenRouter adapters were verified by (a)
  unit tests against their pure/validatable parts (URL parsing, diff
  parsing, response validation) and (b) a full manual click-through of
  **demo mode** in a real browser at a 375px viewport (Playwright +
  Chromium), which exercises the same UI and session-state code as a live
  run, just fed by fixture data instead of live network calls. Live GitHub
  and OpenRouter calls are implemented, not stubbed, but were not observed
  succeeding against real external services in this session.
- **Evidence references are structured strings, not always hyperlinks.**
  `EvidenceRef.url` is optional in the schema and the GitHub adapter does not
  populate exact GitHub line-anchored URLs for every reference (PRD §5.3
  calls exact line links "preferred," not required). Evidence strings are
  always concrete (a file path, a script name, a PR number) but clicking
  through to an exact line is not implemented for every reference type.
- **Open issue count is an approximation when the pulls endpoint fails.** It
  falls back to `open_issues_count - openPullCount`, with a warning surfaced
  in the inventory rather than an exact issue-only count (GitHub's REST API
  does not expose one directly without the search endpoint, which has a much
  lower rate limit).
- **The audit classifier is a heuristic, not a formal verifier.** It cannot
  run tests or execute code; it only reasons over file paths, diff status,
  and keyword overlap between a criterion's text and the diff. It is
  deliberately conservative (unmatched criteria default to `not_proven`,
  never `passed`), which is the behavior the PRD's rubric explicitly rewards,
  but it will sometimes under-credit a criterion a human would recognize as
  satisfied.
- No native Android app, no autonomous coding, no repository writes, no
  scheduled jobs — all correctly out of scope per PRD §11 and not built.

## Commands actually run (this session)

```
bun install                 # dependency install — succeeded
bun run typecheck            # tsc --noEmit — 0 errors
bun run lint                 # eslint — 0 errors, 0 warnings (after one fix)
bun run test                 # vitest run — 6 files, 35 tests, all passed
bun run build                # next build — succeeded, 3 static + 3 dynamic API routes
bun run dev + manual browser click-through of demo mode at 375px viewport
  (Playwright/Chromium, screenshots captured and inspected) — confirmed no
  horizontal scroll, working navigation, working checkbox selection, working
  handoff editing, working audit report with a passed + not_proven mix and
  an unsupported-claim warning, working exports.
```

No test was skipped or marked pending; all 35 assertions pass on a clean
checkout (`bun install && bun run test`).

## Key architectural decisions

- **Handoff generation is deterministic, not model-generated.** PRD §5.5
  explicitly forbids silently converting uncertainty into a design decision.
  An LLM asked to "write a handoff" would tend to smooth over exactly the
  gaps ALFRED exists to surface, so `buildHandoffDraft` builds acceptance
  criteria mechanically from the findings the user selected.
- **The audit classifier is also deterministic and network-free**, per PRD
  §9's explicit testability requirement. This is a stronger commitment than
  strictly required elsewhere in the PRD but follows directly from the
  product's own thesis: an agent's own completion summary is exactly the
  kind of unverified claim ALFRED should not trust, so the classifier does
  not call a model to ask "does this look done?"
- **All secrets are per-request, not per-session-server-state.** There is no
  database and no server-side session store; the Next.js route handlers are
  stateless request/response functions that forward a token/key to
  GitHub/OpenRouter for a single call and never write it anywhere.
- **No next/font/google.** Using it would make a clean-checkout production
  build depend on reaching Google Fonts at build time; the app instead uses
  system font stacks styled to the intended dark/brass "archive" aesthetic
  from the project's design mockups, so `bun run build` cannot fail due to a
  blocked font fetch.

## Requirements intentionally not met, and why

- **Exact GitHub line-number links for every evidence reference** (PRD §5.3,
  "preferred") were not implemented for all evidence kinds — only file-level
  references. Rationale: time was spent on breadth (all six required
  screens, both adapters, the full audit pipeline, and tests) over this
  specific "preferred" (not "required") polish item.
- **No confirmation modal component** for the destructive reset action;
  it uses the browser's native `window.confirm` instead of a custom dialog.
  This satisfies PRD §7's "destructive reset actions require confirmation"
  functionally, but is a minimal implementation rather than a styled modal.
