# ALFRET — The Repository Inspector That Doesn't Lie

> **You send code agents to work on your repositories.** *ALFRET tells you whether they actually did the job.*

ALFRET is not a report generator pretending to understand your code. ALFRET *understands* your repository, and then writes a report as proof.

Other tools check boxes. ALFRET checks *evidence*. It doesn't ask your agent "did you finish?" — it *looks at what changed* and compares it to what you asked for. Side by side. No bullshit.



---

## What ALFRET Does For You

**Prepare the task.** Write down what you want done — files to change, bugs to fix, features to add.

**Audit the result.** ALFRET watches your agent work, sees what actually got changed, and compares it against what you asked for. Changes that weren't requested? ALFRET flags them. Requested changes that didn't happen? ALFRET calls that out too.

**Get proof, not promises.** No agent gets to claim "task complete" without evidence. ALFRET builds the evidence chain: what changed, why it mattered, whether it matched the acceptance criteria. Everything is verifiable. Everything is on the record.

---

## How It Works in Three Screens

**🔍 Repository Inventory** — ALFRET scans your repository and builds a map: what exists, what's stale, what's broken, what's suspicious. It finds leftover TODOs, misplaced files, generated code that needs regenerating, documentation that's out of date.

**📋 The Handoff** — You describe the task. ALFRET assembles the contract: the exact acceptance criteria, the forbidden changes, the required evidence, the constraints. This becomes the law that your agent must obey.

**✅ The Audit** — When the agent claims completion, ALFRET audits the diff line by line against every criterion. Partial? ALFRET says so. Failed? ALFRET shows you why. Perfect? ALFRET proves it.



---

## Built In (What You Actually Get)

- ✅ **Live Agent Monitoring** — Watch agents work in real time. See what they commit before you merge. Get notified about scope creep.

- ✅ **Evidence-First Audit** — Every claim is backed by a verifiable chain: observation → derivation → truth status. No hand-waving. No "trust me bro."

- ✅ **Repository Insight** — ALFRET finds problems you missed. Stale documentation. Leftover debugging code. Files that shouldn't exist. Generated code that's out of sync with the source.

- ✅ **Safe Handoff** — Pass work between agents without losing context. Every agent inherits the decision ledger and understands what was decided and why.

- ✅ **Deterministic Repair** — Stray formatting? Wrong import order? ALFRET can auto-fix it. Non-deterministic? ALFRET refuses to touch it.

- ✅ **Protected Zones** — Define files and directories that are off-limits. Agents can't accidentally break them. The policy is enforced.



---

## The Three Rooms

**Repository-Butler** (`/`) — Where the action happens. Build your inventory, write your handoff contract, watch the audit in progress, export the final report.

**Skriptorium** (`/archive`) — The archive. Store evidence. Read past audits. Follow the audit trail backward to understand what was decided and when.

**Werkstatt** (`/workshop`) — The workshop. Live view of active tasks. Monitor running agents. See heartbeats and status in real time.



---

## Under the Hood

Built on TypeScript + React + Next.js. Database optional (SQLite if you want to keep records). No dependencies on cloud services. No vendor lock-in. Your data stays yours.



---

## Get Started

```bash
bun install
bun run dev
```

Then visit `http://localhost:3000`. No environment setup needed. GitHub tokens and API keys? You enter them in the UI, and they never touch your disk or git history. One request, one use, then they're gone.



---

## The Commands

```bash
bun run dev         # Start dev server
bun run build       # Build for production
bun run start       # Run production build
bun run typecheck   # Check types (strict mode)
bun run lint        # Lint everything
bun run test        # Run tests
```

The complete pipeline (runs in order):
```
bun install → bun run typecheck → lint → test → build
```



---

## Demo Mode

Click **Demo Mode** on the setup screen to run the entire workflow without credentials — no GitHub token, no agent. See what ALFRET audits, how it builds evidence chains, what the final report looks like.

Or hit the API: `POST /api/demo/run` with a public repository URL.



---

## Runner (Optional Local Mode)

Want to run agents on your own machine instead of cloud? ALFRET has a local runner.

```bash
bun runner/src/index.ts probe                  # Check what this machine can do
bun runner/src/index.ts pair                   # Link to your ALFRET instance once
bun runner/src/index.ts --allow-install        # Run with local LLM support
```

The runner reads-only by default. Doesn't install anything. Doesn't run arbitrary shell commands. Every plan is signed and verified before execution. Local policy has the final say.



---

## How It's Organized

**`lib/`** — The brain. Evidence builders, auditors, GitHub integrations. The real work happens here.

**`app/`** — The UI. Three rooms: Repository-Butler (main), Skriptorium (archive), Werkstatt (workshop).

**`runner/`** — Optional. Local agent execution on your hardware.

**`components/`** — React components for each screen and interaction.



---

## Security

**Your tokens stay yours.** You enter credentials in the UI; they're used immediately and discarded. Never written to disk. Never logged. Never committed to git.

**Repository untouched.** ALFRET reads your repo. It never writes, creates PRs, or merges without explicit signed approval.

**Plans are signed.** Code agents run signed execution plans. Unsigned plans are rejected. No exceptions.

**No shell injection.** Commands are argument vectors, not shell strings. Can't trick the runner.

**Agents can't collide.** Two agents trying to work in the same directory? Hermes blocks it at the dispatch layer.

---

## Known Limits

**Contract Map needs an LLM call.** That's where human intent becomes machine-readable criteria. Tests use fixtures; production uses OpenRouter.

**Audit is conservative.** The diff classifier doesn't pretend to be a formal proof system. Default: "not proven" instead of guessing.

**Memory mode loses state on restart.** Use SQLite for persistence.

**GitHub rate limits apply.** Nothing we can do about that. ALFRET respects them.



---

## Why This Matters

**Traditional workflow:** You ask an agent to fix something. It claims it's done. You trust it or review it by hand (same as always).

**ALFRET workflow:** You ask an agent to fix something. ALFRET *reads what changed* and compares it to what you asked. No trust. No guessing. Evidence.

Every line of code has a reason. Every change has a purpose. ALFRET proves both.

---

## Questions?

[Open an issue](https://github.com/lootziffer666/alfret/issues). We read them. We fix them. We ship it.

—ALFRET
