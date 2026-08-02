# ALFRET Development Roadmap

**Current Status:** Etappe 36 ✅ (Dogfood-ready)  
**Version:** 0.1.0  

---

## Phase 1: API Implementation & Stabilization (Aug 2026)

### 1.1 GitHub API Calls → Real Implementation

**Blocked:** Etappe 29 (README Freshness) has placeholder functions

```typescript
// lib/daemon/jobs/readme-freshness.ts
async function fetchLastMergedPr(_repo: string, _token: string, _excludeAuthor: string)
async function fetchLastReadmeCommit(_repo: string, _token: string)
async function anyDocRelevantChangesSince(_repo: string, _token: string, _sinceDate: string, globs: string[])
async function buildStatusBlock(_repo: string, _pr: { number: number })
```

**Actions:**
- Use `ghFetch` from lib/github.ts (Etappe 27)
- Query GitHub API for merged PRs, commits, compare
- Filter commits by author (exclude daemon-commits)
- Match touched files against docRelevantGlobs

**Est. Time:** 4 hours  
**Blocks:** Demo daemon run, README auto-updates

### 1.2 Dependencies Clean & TypeScript

**Blocked:** Missing packages (next/server, zod, react)

**Actions:**
```bash
npm install
npm run typecheck  # Fix ~200 TS errors
```

**Est. Time:** 2 hours

### 1.3 Unit Tests for Core Paths

**Done:**
- gitignore.test.ts (10 tests)
- maidRules.test.ts (8 tests)
- readmeFreshness.test.ts (9 tests)

**Needed:**
- Daemon scheduler tests (overlap guard, tick pruning)
- executeWrite tests (scope, paths, dry-run)
- compareRefs tests
- Audit log append-only verification
- Budget exhaustion tests

**Est. Time:** 8 hours

### 1.4 Integration Test: Daemon on ALFRET Itself

**Setup:**
```bash
cd ~/.alfret
daemon run --armed=false --dryRun=true
```

**Expected:**
- maid-scan finds 1 minor (.tsbuildinfo already in gitignore ✅)
- readme-freshness detects README is stale
- No actual writes (dryRun=true)
- Audit log records everything

**Est. Time:** 2 hours

---

## Phase 2: Skills & Custom Jobs (Aug-Sep 2026)

### 2.1 Skill Manifest Loading

**Modules:**
- `lib/skills/select.ts` — skeleton, needs real impl
- `lib/skills/writer.ts` — boilerplate generator
- `lib/skills/generate.ts` — never LLM, just structure

**Actions:**
- Load `manifest.json` from skill directories
- Validate structure (name, description, triggers, jobFile)
- Parse feature flag requirements
- Register jobs with scheduler

**Est. Time:** 4 hours

### 2.2 Custom Job Registration & Execution

**Goal:** example-daemon-skill runs in real daemon loop

**Actions:**
- Modify scheduler to load skills at startup
- Call skill.run(JobContext) alongside built-in jobs
- Collect findings & writes
- Respect feature flags (allowLlmGeneration, etc.)

**Est. Time:** 3 hours

### 2.3 Example Skill: `example-daemon-skill` → Real

**Current:** Returns `{status: "ok", findings: [], writes: []}`

**Make it real:**
- Scan for TODO comments
- Create findings for old TODOs
- Suggest refactoring PR if many found
- Test with dogfood run

**Est. Time:** 2 hours

### 2.4 Template & Documentation

**Deliver:**
- Skill template generator
- Manifest validator
- Example repository with full skill

**Est. Time:** 3 hours

---

## Phase 3: Observability & Self-Healing (Sep 2026)

### 3.1 Health Registry Live Integration

**Current:** `lib/health/registry.ts` exists, not used

**Actions:**
- Integrate into daemon loop
- Record checks for: store, github-token, scheduler, rate-limit
- Aggregate overall status
- Expose via WebSocket bridge

**Est. Time:** 3 hours

### 3.2 Fusebox Auto-Recovery

**Current:** FuseBox tracks blown fuses, no auto-reset

**Actions:**
- Add time-based auto-reset (configurable, default 5 min)
- Re-enable subsystems when they pass self-test
- Log recovery events to audit trail

**Est. Time:** 2 hours

### 3.3 Timeline Snapshots Live

**Current:** Snapshot structure exists, no data collection

**Actions:**
- Collect state after each tick: findings count, job duration, writes
- Store in timeline entity
- Expose via components/timeline/ArchitectureTimeMachine

**Est. Time:** 2 hours

### 3.4 Dashboard: Real-time Daemon Status

**UI Features:**
- Live health status (repo by repo)
- Active findings (by kind, severity)
- Audit trail (last 20 events)
- Budget usage (writes this tick, PRs today)
- Timeline graph (findings over time)

**Est. Time:** 6 hours

---

## Phase 4: Production Hardening (Sep-Oct 2026)

### 4.1 Load Testing

**Scenario 1:** 100 repositories, 10 jobs each
- Measure scheduler overhead
- Verify no memory leaks (long-running daemon)
- Confirm tick times stay < 2s

**Scenario 2:** Edge cases
- Large repos (10k files)
- Many PRs (1000+ open)
- Rate limit recovery

**Est. Time:** 6 hours (test design + execution)

### 4.2 Failure Scenarios

**Test:**
- GitHub API failures (500, 429, timeout)
- Token expiry
- Merge conflicts
- Concurrent edits (409)
- Disk full
- Daemon crash + restart

**Expected:** Audit log complete, state recoverable, zero data loss

**Est. Time:** 8 hours

### 4.3 Security Audit

**Review:**
- Credentials never in logs ✅ (scrubber in log.ts)
- Credentials never in argv ✅ (config only)
- Protected paths respected ✅ (scope.ts)
- Audit log immutable ✅ (append-only event_store)
- Feature flags not bypassable ✅ (Zod defaults)

**Needed:**
- Penetration test (ALFRET hosting ALFRET)
- Fuzz testing (malformed inputs)
- Rate-limit evasion attempts

**Est. Time:** 4 hours

### 4.4 Documentation Complete

**Deliver:**
- API reference (all exported types)
- Architecture guide (Store, Jobs, Features)
- Operations manual (daemon deployment, debugging)
- Contributing guide (adding skills, extending)
- Troubleshooting (common errors, recovery)

**Est. Time:** 8 hours

---

## Phase 5: Real-World Deployments (Oct-Nov 2026)

### 5.1 ALFRET on Public Repositories

**Deploy on:** 2-3 OSS projects with owner permission

**Collect:**
- Actual findings (vs. synthetic test data)
- False positive rate
- Skill quality feedback
- Daemon stability metrics

**Est. Time:** Ongoing (2 weeks minimum)

### 5.2 Feedback Incorporation

**Actions:**
- Fix high-FP findings
- Tune budget limits
- Improve classifier accuracy
- Enhance markers for common patterns

**Est. Time:** 4 hours/week

### 5.3 Release & Announcement

**Prepare:**
- Changelog (Etappen 17-36 summary)
- Installation guide
- Quick-start tutorial
- Demonstration (screenshots, video)

**Est. Time:** 4 hours

---

## Summary

| Phase | Time | Blocking | Deliverable |
|-------|------|----------|------------|
| 1 | ~16h | Nothing | Stable, tested, working daemon |
| 2 | ~12h | Phase 1 | Custom skills framework |
| 3 | ~13h | Phase 2 | Real-time observability dashboard |
| 4 | ~26h | Phase 3 | Production-ready, audited |
| 5 | Ongoing | Phase 4 | Real-world deployments |

**Total to Production:** ~67 hours = ~2 weeks (1 developer full-time)

---

## Critical Path

```
Phase 1 APIs → Phase 1 Tests → Phase 1 Demo
                                    ↓
                              Phase 2 Skills
                                    ↓
                              Phase 3 Dashboard
                                    ↓
                              Phase 4 Audit
                                    ↓
                              Phase 5 Deploy
```

**Go/No-Go Gate after Phase 1 Demo:** If daemon runs on self and creates accurate README-update PR, ready to proceed.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| GitHub API changes | Regular integration tests, version pinning |
| Token expiry during long jobs | Refresh logic, graceful degradation |
| Concurrent daemon starts | PID-based lock (already impl) |
| Large repository timeouts | Budget limits + job splitting (future) |
| Feature creep delaying release | Scope locked at Etappe 36, defer Phase 5 features |

---

*Roadmap last updated: 2026-08-02*  
*Next review: After Phase 1 completion*
