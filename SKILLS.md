# ALFRET Skills Catalog

**Version:** 0.1.0  
**Status:** Framework ready, Examples in place

---

## What is a Skill?

Ein Skill ist ein Custom Job für ALFRET. Es ist:
- **Rein:** Keine Seiteneffekte außer Findings und PlannedWrites
- **Dokumentiert:** Manifest mit Name, Description, Triggers
- **Testbar:** Input → Output, kein State außer dem Store
- **Sicher:** Alle Feature-Flags müssen explizit gesetzt sein

---

## Example Skill: `example-daemon-skill`

**Location:** `catalog/skills/example-daemon-skill/`

```typescript
import type { Job, JobContext, JobResult } from "../../../lib/daemon/jobs/types.js";

export const exampleDaemonSkill: Job = {
  name: "example-daemon-skill",

  async run(_jc: JobContext): Promise<JobResult> {
    return {
      status: "ok",
      findings: [],
      writes: [],
    };
  },
};
```

**To use:** Register in daemon config, load via skills framework.

---

## Skill Development Framework

### 1. Manifest (`catalog/skills/my-skill/manifest.json`)

```json
{
  "name": "my-skill",
  "description": "Beschreibung",
  "triggers": ["maid-scan", "readme-freshness"],
  "version": "0.1.0",
  "jobFile": "index.ts",
  "requiredFlags": ["allowSomething"],
  "maxExecutionTimeMs": 30000
}
```

### 2. Job Implementation (`catalog/skills/my-skill/index.ts`)

```typescript
import type { Job, JobContext, JobResult } from "../../../lib/daemon/jobs/types.js";

export const mySkill: Job = {
  name: "my-skill",

  async run(jc: JobContext): Promise<JobResult> {
    const { ctx, repo, log } = jc;

    log.info("Skill executing", { repo: repo.repository });

    // Findings
    const findings = [];
    
    // PlannedWrites (for automatic PRs)
    const writes = [];

    return { status: "ok", findings, writes };
  },
};
```

### 3. Registration

In daemon config:
```json
{
  "skills": [
    "catalog/skills/example-daemon-skill",
    "catalog/skills/my-skill"
  ]
}
```

---

## Future Skills (Ideas)

### 1. **dependency-audit**
- Scan für outdated packages
- CVSS-Scoring
- Auto-PR für patch versions

### 2. **license-check**
- Verify all deps haben compatible Lizenzen
- Flag GPLv3 in commercial projects
- Recommend alternates

### 3. **test-coverage**
- Parse coverage reports
- Find untested code paths
- Suggest high-value areas for testing

### 4. **api-drift**
- Track OpenAPI/GraphQL schema changes
- Flag breaking changes
- Generate migration guides

### 5. **performance-regression**
- Benchmark tracking
- Detect slowdowns
- Alert on critical regressions

### 6. **security-audit**
- Credential scanning
- Dependency vulnerability check
- OWASP rule enforcement

### 7. **documentation-sync**
- Verify docs match code
- Flag outdated examples
- Auto-update from docstrings

---

## How to Add Your Skill

1. Create `catalog/skills/your-skill/`
2. Write `manifest.json`
3. Implement `index.ts` (export Job)
4. Test with `npm run test -- your-skill.test.ts`
5. Register in daemon config
6. Daemon loads and runs automatically

---

## Constraints

- **No LLM generation:** Content muss Evidence-based sein
- **No shell spawn:** Nur API calls, kein shell-escape risk
- **No long-running:** max 30s execution time
- **No stateful:** State muss im Store live (entity-based)
- **No hardcoded paths:** Alles über context params

---

## Feature Flags

Skills können Feature-Flags require:

```typescript
if (!isLlmGenerationAllowed(ctx.flags)) {
  return { status: "skipped", findings: [], writes: [] };
}
```

Default: **false** (opt-in safety)

---

## Testing Skills

```bash
npm run test -- tests/mySkill.test.ts
```

Mock JobContext:
```typescript
const mockCtx: JobContext = {
  ctx: { /* DaemonContext */ },
  repo: { repository: "owner/repo" },
  log: { /* Logger */ },
};

const result = await mySkill.run(mockCtx);
expect(result.status).toBe("ok");
```

---

## Deploying Skills

Skills werden als Git-Commit deployed. Nach Merge:

```bash
cd ~/.alfret
git pull
daemon run --armed=true  # Lädt neue Skills automatisch
```

---

*ALFRET Skills — Evidence-first, Safe-by-default, Extensible.*
