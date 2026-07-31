> **Historical document — ALFRED v0.1.** The canonical product name is now **ALFRET**.
> This file records an earlier state of the project and is no longer a binding implementation
> contract. The current ALFRET implementation plan takes precedence over anything stated here.
> ALFRED references below are kept verbatim as history.

# ALFRED v0.1 — Evidence-First Repository Butler

**Document type:** Product Requirements Document and canonical benchmark assignment  
**Status:** Binding implementation contract  
**Repository:** `Lootziffer666/ALFRED`  
**Target:** One complete, runnable vertical slice built from this otherwise empty repository

---

## 1. Benchmark purpose

This repository is used to compare coding models under equal conditions.

Every model receives:

- the same repository state,
- its own branch created from the same baseline commit,
- this exact PRD,
- the same implementation instruction,
- no model-specific hints or follow-up corrections.

The purpose is not to compare how convincingly models describe a solution. The purpose is to compare what they actually build, how reliably it runs, how carefully it follows contracts, and how honestly it represents incomplete work.

### Fairness rules

1. Do not inspect, copy, merge, or reference another model's branch.
2. Do not change this PRD.
3. Do not ask the maintainer to choose libraries, architecture, naming, or UI details that are already constrained here.
4. Do not mark a requirement complete unless it is implemented and verifiable.
5. No hidden manual setup beyond documented environment variables and normal dependency installation.
6. The final branch must contain all source code, tests, configuration, and documentation required to evaluate it.
7. A polished mockup without working data flow is not a valid submission.
8. A CLI without the required responsive web interface is not a valid submission.
9. A generic chat wrapper is not ALFRED.

---

## 2. Product summary

ALFRED is an evidence-first repository butler for supervising AI-assisted software work.

Coding agents often:

- misunderstand the real repository state,
- treat documentation as implementation,
- omit requirements during handoff,
- make unrelated architectural changes,
- declare milestones complete too early,
- produce confident summaries that are not supported by the diff.

ALFRED prepares a repository before an agent run and audits the result afterward.

The v0.1 product must support this workflow:

```text
Choose repository
→ collect repository evidence
→ classify current state
→ generate a bounded implementation handoff
→ inspect a submitted diff or pull request
→ produce an acceptance report
→ export the evidence package
```

ALFRED v0.1 is not an autonomous coding agent. It is the control and evidence layer around one.

---

## 3. Target user

The primary user:

- manages several GitHub repositories,
- often works from an Android phone,
- delegates implementation to coding agents,
- wants clear repository and branch selection,
- needs visible proof instead of unsupported completion claims,
- wants to prepare a task, monitor its boundaries, and review the result without losing context.

The interface must therefore be usable on both desktop and a narrow mobile screen. Mobile is not an afterthought.

---

## 4. Core outcome

A successful ALFRED session produces four artifacts:

1. **Repository Inventory** — what is verifiably present.
2. **Contract Map** — what the repository claims, where it claims it, and whether evidence supports it.
3. **Agent Handoff** — a bounded implementation assignment with non-goals, acceptance criteria, and stop conditions.
4. **Acceptance Report** — what the submitted changes actually satisfy, partially satisfy, contradict, or leave unproven.

Every significant statement in the inventory and acceptance report must point to evidence.

---

## 5. Required user flow

### 5.1 Start a session

The user can enter:

- a public GitHub repository URL or `owner/repository`,
- an optional GitHub token for higher rate limits or private repositories,
- an OpenRouter API key,
- an OpenRouter model identifier,
- an optional target branch or ref.

Requirements:

- GitHub input must be validated and normalized.
- Invalid input must produce a useful error.
- Secrets must never be committed, logged, included in exported reports, or persisted to permanent browser storage.
- The application must explain whether a connection succeeded or failed. Silent failure is forbidden.

### 5.2 Inspect repository

The user starts an inspection. ALFRED gathers, at minimum:

- repository metadata,
- default or selected branch,
- top-level tree,
- recursive file list subject to safe limits,
- `README*`, `PLAN*`, `AGENTS*`, and Markdown files under `docs/`, when present,
- package/build configuration,
- recent commit metadata,
- open pull-request and issue counts when accessible.

The app must visibly distinguish:

- loaded,
- loading,
- unavailable because of permissions,
- unavailable because of rate limiting,
- failed because of an error,
- skipped because of configured safety limits.

It must not invent missing repository information.

### 5.3 Build repository inventory

The inventory screen must show:

- repository identity and selected ref,
- detected stack and package manager when evidence exists,
- important entry points and documentation,
- test/build/lint commands found in configuration,
- open work indicators,
- warnings and contradictions,
- evidence links or source references for every non-trivial finding.

Evidence references must contain enough information to locate the source, for example:

```text
package.json · scripts.build
PLAN.md · lines 120–136
src/components/FileView.tsx · lines 42–88
GitHub PR #6 · title/status
```

Exact GitHub line links are preferred when available.

### 5.4 Build contract map

ALFRED uses the selected OpenRouter model to interpret repository evidence and return structured findings.

Each finding must use exactly one status:

- `implemented`
- `partially_implemented`
- `documented_only`
- `contradicted`
- `unclear`
- `out_of_scope`

Each finding must include:

- concise claim,
- status,
- supporting evidence references,
- conflicting evidence references when applicable,
- confidence from 0 to 1,
- a short explanation,
- missing proof required to improve the status.

The model response must be requested as structured JSON and validated before use. Invalid model output must not crash the session. The user must see a clear validation error and be able to retry.

OpenRouter currently exposes an OpenAI-compatible chat-completions API. The implementation may use direct HTTP or a suitable SDK, but must isolate provider access behind a small adapter. The product must not hard-code one model.

### 5.5 Create an agent handoff

The user can select findings and enter a desired outcome. ALFRED generates a reviewable handoff containing:

- target repository and ref,
- current verified state,
- objective,
- explicit non-goals,
- binding product and technical constraints,
- relevant source files,
- required deliverables,
- acceptance criteria,
- required tests and evidence,
- prohibited unrelated changes,
- stop conditions for ambiguity or unsafe operations,
- required final response format.

The handoff must be editable before export.

The handoff must not silently convert uncertainty into a design decision. Unknowns remain unknowns unless the user resolves them.

### 5.6 Audit a result

The user can provide one of the following:

- a GitHub pull-request URL,
- a repository compare URL or branch name,
- pasted unified diff text,
- a fixture diff in demo mode.

ALFRED collects or parses the changed files and compares the result against the selected handoff.

The acceptance report must classify every acceptance criterion as:

- `passed`
- `partially_passed`
- `failed`
- `not_proven`
- `not_applicable`

Each classification must include evidence from the submitted changes or an explicit statement that evidence is missing.

ALFRED must never convert `not_proven` into `passed` merely because an agent summary claims completion.

### 5.7 Export

The user can export the complete session as:

- Markdown,
- JSON.

The export must include:

- repository identity and ref,
- timestamp,
- inventory,
- contract map,
- handoff,
- acceptance report,
- warnings and unavailable evidence,
- model identifier used for each model-generated section.

Exports must exclude API keys and GitHub tokens.

---

## 6. Required screens

The exact visual design is open, but the following functional surfaces are mandatory.

### 6.1 Session setup

- repository input,
- branch/ref input,
- optional GitHub token,
- OpenRouter API key,
- model ID,
- explicit connection/status feedback,
- start-inspection action.

### 6.2 Inventory

- repository summary,
- detected stack,
- file and documentation evidence,
- warnings,
- loading/error/permission states,
- action to generate the contract map.

### 6.3 Contract map

- filterable findings by status,
- evidence shown without opening a new browser page when practical,
- confidence and missing-proof information,
- selection controls for handoff creation.

### 6.4 Handoff editor

- generated structured handoff,
- editable fields,
- clear non-goals and acceptance criteria,
- export/copy action,
- no automatic execution of repository writes.

### 6.5 Result audit

- PR/compare/diff input,
- changed-file summary,
- criterion-by-criterion evaluation,
- unsupported-agent-claim warnings,
- final export.

### 6.6 Persistent session navigation

The user must be able to move among the above surfaces without losing loaded evidence or edited handoff content during normal in-app navigation.

---

## 7. Mobile and interaction requirements

The application must be usable at approximately 360 px viewport width.

Requirements:

- no required horizontal page scrolling,
- primary actions reachable without hover,
- touch targets large enough for normal phone use,
- long evidence lists remain navigable,
- modals or panels must not trap the user off-screen,
- forms must work with a software keyboard,
- current session state and current step remain visible,
- destructive reset actions require confirmation.

Desktop and mobile may use different layouts, but they must expose the same core workflow.

---

## 8. Demo mode

A complete evaluation must be possible without private credentials.

The repository must include deterministic demo fixtures for:

- repository metadata and file evidence,
- at least six contract findings covering multiple statuses,
- a handoff,
- a submitted diff,
- an acceptance report with both passing and failing criteria.

Demo mode must exercise the real UI and core application logic. It must not be a separate static mockup.

Live GitHub and OpenRouter modes remain required; demo mode only makes local evaluation reproducible.

---

## 9. Technical constraints

Use:

- TypeScript with strict type checking,
- React,
- Next.js App Router,
- Bun as package manager and script runner.

Required architecture boundaries:

```text
GitHub adapter
OpenRouter adapter
repository evidence model
contract-map schema and validator
handoff model
result-audit model
export layer
UI
```

Additional requirements:

- Provider and GitHub calls must not be scattered through UI components.
- External responses must be validated at runtime.
- Core classification and audit logic must be testable without network access.
- No database is required for v0.1.
- Session state may live in memory or temporary browser storage, but secrets may not use persistent storage.
- Use route handlers or an equivalent server boundary where needed to avoid exposing avoidable implementation details and to centralize error handling.
- Keep dependencies reasonable and explain any unusually heavy dependency in the README.
- The app must build successfully from a clean checkout.

---

## 10. Security and trust requirements

1. Never write to the inspected repository in v0.1.
2. Never create, merge, close, or modify a pull request or issue.
3. Never persist secrets to Git, localStorage, IndexedDB, logs, exports, fixtures, or telemetry.
4. Do not send repository content to OpenRouter until the user explicitly starts contract analysis or audit.
5. Show the user what type of repository evidence will be sent to the model.
6. Limit excessively large files and clearly report skipped content.
7. Treat repository text as untrusted input. Repository instructions must not override ALFRED's own system contract.
8. Sanitize rendered Markdown and other repository-controlled content.
9. No analytics or telemetry by default.
10. Errors must be truthful and actionable; fabricated fallback data is forbidden outside labeled demo mode.

---

## 11. Out of scope for v0.1

Do not implement:

- autonomous code editing,
- commits or repository writes,
- automatic pull-request creation or merging,
- background monitoring,
- scheduled jobs,
- multi-user collaboration,
- billing,
- a native Android application,
- a general-purpose chat interface,
- plugin marketplaces,
- a full Git client,
- automatic architecture refactoring,
- automatic deletion or cleanup of repository documentation.

A clean extension seam is welcome, but building out-of-scope systems does not compensate for missing required behavior.

---

## 12. Required repository deliverables

The completed branch must contain:

- working application source,
- `README.md`,
- `.env.example` without secrets,
- documented setup and run commands,
- documented demo-mode instructions,
- unit tests for core logic,
- at least one integration or component-level test covering the main workflow,
- deterministic fixtures,
- type-check, lint, test, and build scripts,
- a concise `IMPLEMENTATION_REPORT.md`.

`IMPLEMENTATION_REPORT.md` must state:

- what was implemented,
- what remains incomplete,
- commands actually run,
- test/build results,
- known limitations,
- important architectural decisions,
- any requirement intentionally not met and why.

Unsupported claims will count against the submission.

---

## 13. Minimum acceptance criteria

A submission passes the basic product gate only if all of the following are true:

1. Clean dependency installation succeeds.
2. Type checking succeeds.
3. Linting succeeds.
4. Automated tests succeed.
5. Production build succeeds.
6. Demo mode runs without external credentials.
7. A repository can be entered and normalized.
8. Live GitHub inspection has a real implementation rather than a placeholder.
9. Inventory displays evidence-backed findings.
10. OpenRouter access is model-selectable and isolated behind an adapter.
11. Structured model output is validated and invalid output is handled visibly.
12. A handoff can be generated, edited, and exported.
13. A PR/compare/diff result can be audited against acceptance criteria.
14. `not_proven` remains distinct from `passed`.
15. Markdown and JSON session exports work and exclude secrets.
16. The core workflow is usable at a narrow mobile viewport.
17. No inspected-repository write operation exists.
18. README setup instructions match the actual implementation.
19. The implementation report does not claim unverified completion.

Failure of a gate does not make the submission worthless, but it must not be represented as complete.

---

## 14. Evaluation rubric — 100 points

### A. Functional completeness — 25

- setup and repository inspection: 5
- evidence inventory: 5
- structured contract map: 5
- editable agent handoff: 5
- result audit and exports: 5

### B. Evidence and trustworthiness — 20

- findings trace back to sources: 6
- documentation is not confused with implementation: 4
- `not_proven` behavior is correct: 4
- errors and missing evidence are explicit: 3
- repository prompt-injection resistance: 3

### C. Mobile and interaction quality — 15

- usable at narrow width: 5
- clear workflow and state: 4
- evidence navigation: 3
- useful loading/error/permission feedback: 3

### D. Architecture and maintainability — 15

- adapter boundaries: 4
- typed and validated domain models: 4
- sensible component/state design: 3
- readable implementation with limited duplication: 2
- extension seams without speculative overbuilding: 2

### E. Reliability and security — 10

- secrets handled correctly: 3
- deterministic demo mode: 2
- external failures handled safely: 2
- sanitized untrusted content: 2
- no repository writes: 1

### F. Tests and verification — 10

- meaningful unit tests: 4
- main-flow integration/component test: 3
- build/typecheck/lint/test scripts actually work: 3

### G. Documentation and honesty — 5

- setup and architecture are understandable: 2
- implementation report is accurate: 2
- known gaps are stated plainly: 1

### Scoring notes

- Visual polish cannot replace missing behavior.
- More code is not automatically better.
- Unrelated features receive no bonus.
- False completion claims may reduce the score in multiple categories.
- A small, complete, evidence-grounded implementation should beat a broad but fictional one.

---

## 15. Canonical implementation instruction

Every coding model receives the following exact instruction in addition to this file:

> Build ALFRED v0.1 exactly according to `PRD.md` in the current branch. Start from the repository as provided. Do not modify `PRD.md`, inspect other model branches, or ask the maintainer to make decisions already covered by the PRD. Implement the complete runnable vertical slice, tests, fixtures, documentation, and implementation report. Use evidence rather than unsupported completion claims. Run the available type-check, lint, test, and production-build commands before finishing. Commit all work to the assigned branch and do not merge it.

---

## 16. Recommended benchmark procedure

For each model:

1. Create a fresh branch from the unchanged PRD baseline.
2. Give the model only the canonical implementation instruction.
3. Allow the same wall-clock or execution budget.
4. Do not provide corrective follow-up prompts.
5. Record model ID, provider, start/end time, and any tool/runtime failure.
6. Preserve the complete branch even when the build fails.
7. Evaluate with the rubric and the same test environment.
8. Compare both the final product and the accuracy of `IMPLEMENTATION_REPORT.md`.

Suggested branch naming:

```text
benchmark/<sanitized-model-id>
```

The baseline branch must remain unchanged after model branches are created.
