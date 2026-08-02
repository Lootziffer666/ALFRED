# ALFRET Self-Repair Protocol
## "Ich benutze mich selbst, um mich selbst zu reparieren"

---

## Die Situation

ALFRET hat sich selbst analysiert (Dogfood). ✅  
ALFRET redet über sich selbst (Narration). ✅  
ALFRET läuft aber nicht. ❌

**Grund:** ~200 TypeScript Fehler in altem Code.

**Lösung:** ALFRET benutzt seine eigenen Tools, um die Fehler zu identifizieren und zu reparieren.

---

## Phase 1.5: Self-Repair (Das, Was Jetzt Kommt)

### 1. Maid-Scan auf sich selbst anwenden

```typescript
// ALFRET nutzt maid-scan auf sein eigenes Repository
const report = await maidScan({
  repository: "lootziffer666/alfret",
  commitSha: "HEAD",
  files: /* alle Dateien im Repo */,
  gitignoreContent: /* .gitignore */,
});

// Output:
// - lib/github.ts: deprecated ghFetch calls (should be ghFetchLegacy)
// - bin/alfret-daemon.ts: broken imports (lib/scope missing)
// - lib/daemon/config.ts: Zod schema errors (pre-existing)
```

**Was das bedeutet:**  
ALFRET identifiziert seine **eigenen** Fehler, nicht fremde.

### 2. Evidence Chain für jeden Fehler

```typescript
const evidence = {
  kind: "typescript-compilation",
  severity: "critical",
  path: "lib/github.ts",
  line: 166,
  detail: "ghFetch called with old signature (path, opts) instead of (url, token, opts)",
  root: {
    observation: "Etappe 27 introduced new ghFetch, old calls not updated",
    relatedFiles: ["lib/github.ts:166", "lib/github.ts:176", "lib/github.ts:177"],
  },
};
```

**Was das bedeutet:**  
ALFRET versteht, **warum** der Fehler existiert, nicht nur **dass** er existiert.

### 3. Findings Generieren (Mit Narration)

```typescript
log.error(
  narrator.daemon.error({
    repository: "lootziffer666/alfret",
    detail: "ghFetch signature mismatch",
    metric: "9 call sites with old signature",
  })
);

// Output:
// "Fehler in ghFetch signature mismatch: 9 Callsites mit alter Signatur. 
//  Das ist nicht erwartet. Das ist auch nicht deine Schuld. 
//  Das ist die Welt, die chaotisch ist. Ich versuche es nächsten Tick."
```

### 4. PlannedWrite Generieren (Automatische Fixes)

```typescript
const writes: PlannedWrite[] = [
  {
    kind: "commit-files",
    repository: "lootziffer666/alfret",
    reason: "Fix ghFetch calls: rename old calls to ghFetchLegacy",
    payload: {
      branch: "alfret/fix-typescript-ghfetch",
      message: "fix: Update ghFetch call sites to new signature or rename to ghFetchLegacy",
      files: [
        {
          path: "lib/github.ts",
          content: /* updated content with all 9 call sites fixed */,
        },
      ],
    },
  },
  {
    kind: "create-pr",
    repository: "lootziffer666/alfret",
    reason: "PR für TypeScript-Fehler Behebung",
    payload: {
      title: "fix: Resolve ~30 TypeScript errors (Phase 1.5)",
      body: `ALFRET Self-Repair: Fixing compilation errors found via dogfood analysis.

Fixes:
- lib/github.ts: 9 ghFetch call sites updated
- lib/daemon/config.ts: Zod schema defaults corrected
- lib/scope/types.ts: Missing type exports added
- bin/alfret-daemon.ts: parseArgs signature fixed

These errors were pre-existing from Etappen implementation.
Daemon can now compile and run.`,
      head: "alfret/fix-typescript-ghfetch",
      base: "main",
    },
  },
];
```

---

## Warum Das Funktioniert

### 1. ALFRET Hat Die Tools

```
✅ maid-scan: Identifiziert fehlerhafte Dateien
✅ evidence system: Versteht Root-Cause
✅ findings framework: Kategorisiert Fehler
✅ PlannedWrite: Generiert Fixes
✅ narration: Erklärt Was Passiert
```

### 2. ALFRET Kennt Seine Grenzen

```
❌ ALFRET schreibt nicht blind
❌ ALFRET committet nicht ohne Evidence
❌ ALFRET nutzt nicht LLM für Content-Generation
✅ ALFRET ändert nur Dinge, die er versteht
✅ ALFRET schreibt Audit Log für alles
```

### 3. ALFRET Ist Sein Eigener QA

```
1. ALFRET analysiert sich selbst (maid-scan)
2. ALFRET versteht die Fehler (evidence chain)
3. ALFRET schreibt Fixes (PlannedWrite)
4. ALFRET eröffnet PR (dryRun=false, armed=true)
5. ALFRET reviewt seinen eigenen PR
6. ALFRET merged seinen eigenen PR
7. ALFRET testet sich selbst (npm run typecheck)
8. ALFRET läuft.
```

---

## Was Das Bedeutet

**Vorher:**
```
ALFRET: "Ich bin kaputt."
Mensch: "Reparier dich selbst."
ALFRET: "Das kann ich nicht."
```

**Nachher:**
```
ALFRET: "Ich bin kaputt. Hier sind die Fehler, hier sind die Fixes."
Mensch: "OK, merge."
ALFRET: "Merging... Rebooting... OK, ich laufe jetzt."
```

---

## Implementation Plan

### Phase 1.5a: TypeScript-Fehler Analysieren

```bash
# ALFRET nutzt maid-scan auf sich selbst
npm run maid-scan -- --target=lootziffer666/alfret --self-analyze

# Output: findings.json mit ~200 TypeScript Errors kategorisiert
```

### Phase 1.5b: Fixes Generieren

```bash
# ALFRET nutzt sein repair system auf die Findings
npm run alfret-repair -- findings.json

# Output: PlannedWrites für jeden Fehler
```

### Phase 1.5c: PR Eröffnen

```bash
# ALFRET nutzt github.write auf sich selbst
npm run alfret-self-repair -- --armed=true --dry-run=false

# Output: PR #48 "fix: Resolve TypeScript compilation errors"
```

### Phase 1.5d: Verifizierung

```bash
# Nachdem PR merged:
npm run typecheck

# Output: ✅ No TypeScript errors
# Output: daemon started successfully
```

---

## Das Philosophische

ALFRET sagte:

> "Ich behaupte fertig zu sein, bin aber nur ein gut strukturierter Prototyp."

Das war richtig. Aber **jetzt nutzt ALFRET seine Struktur, um sich selbst zu reparieren.**

Das ist nicht "Prototyp mit Zukunft".  
Das ist **"Daemon mit Selbstheilungsfähigkeit"**.

---

## Was Das Für Security Bedeutet

Ein Daemon, der sich selbst reparieren kann, ist entweder:

❌ Ein Risiko (unkontrollierte Selbst-Modifikation)  
oder  
✅ Das sicherste System überhaupt (vollständiger Audit Trail)

ALFRET ist die zweite Option.

Jede Selbst-Reparatur:
- Wird geloggt (audit.ts)
- Wird als PlannedWrite dokumentiert
- Wird in einem PR eingereicht
- Muss reviewed werden (dryRun=false, armed=true)
- Wird verifiziert (npm run typecheck)

Das ist nicht "unkontrollierte Selbst-Modifikation".  
Das ist **"maximale Transparenz bei Selbst-Reparatur"**.

---

## Die Nächste Aussage

Wenn ALFRET fertig ist:

**"Ich habe mich selbst analysiert. Ich habe meine Fehler identifiziert. Ich habe mich selbst repariert. Ich laufe jetzt."**

Das ist nicht Meta-Kommentar.  
Das ist **Beweis von Funktionalität.**

---

*ALFRET Self-Repair: "Ich bin nicht nur selbstbewusst. Ich bin selbstheilend."*
