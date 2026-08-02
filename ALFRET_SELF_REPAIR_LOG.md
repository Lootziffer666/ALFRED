# ALFRET Self-Repair Log
## "Ich benutze mich selbst, um mich zu reparieren"

**Start:** 2026-08-02  
**Status:** IN PROGRESS (Phase 1.5)

---

## Was Passiert

ALFRET ist kaputt (TypeError, ~200 Fehler).  
ALFRET nutzt seine eigenen Analyse-Tools um die Fehler zu identifizieren.  
ALFRET schreibt Fixes basierend auf seinen Evidence Chains.  
ALFRET wird nicht nur repariert — ALFRET repariert sich selbst.

---

## Round 1: lib/github.ts fetchRepoEvidence

### Problem Identifiziert
```
lib/github.ts(166): error TS2345: ghFetch called with old signature
  Old: ghFetch(path, { token })
  New: ghFetch(url, token, opts?)
```

### Root Cause
Etappe 27 introduced new `ghFetch` signature.  
`fetchRepoEvidence` function still used old signature.  
Type mismatch between `GhFetchResult` and old function's expectations.

### Evidence Chain
```
File: lib/github.ts:166-178
Kind: TypeScript signature mismatch
Severity: Critical (blocks compilation)
Root: Etappe 27 refactor not propagated to all call sites
Related: 20+ errors in same function
```

### Fix Applied
✅ Updated fetchRepoEvidence to new ghFetch signature:
- Add `API_ROOT` to all URLs
- Pass `token` as second param (not in options)
- Handle `GhFetchResult` type properly
- Check `.data` field before access
- Fail-closed on token missing

### Commit
```
a7e1c33 — fix: Update fetchRepoEvidence to use new ghFetch signature
```

### Result
```
Before: ~20 TypeScript errors in fetchRepoEvidence
After:  ✅ 0 errors in fetchRepoEvidence
Total errors: 200 → 180 (10% reduction)
```

---

## Remaining Issues (Priority Order)

### 1. lib/daemon/audit.ts — Missing Import
```
error TS2307: Cannot find module '../scope.js'
```
**Fix:** Create lib/scope.ts with proper exports  
**Impact:** ~5 errors

### 2. lib/daemon/config.ts — Zod Schema Errors
```
error TS2554: Expected 2-3 arguments, but got 1
```
**Fix:** Update Zod schema default values  
**Impact:** ~8 errors

### 3. bin/alfret-daemon.ts — Config Loading
```
error TS2739: Type 'Promise<LoadConfigResult>' missing properties
```
**Cause:** Awaits not being used on async config loading  
**Fix:** Properly await config/credentials/scope loads  
**Impact:** ~30 errors

### 4. lib/daemon/bridge.ts — Missing ws Module
```
error TS2307: Cannot find module 'ws'
```
**Fix:** Install @types/ws or remove if unused  
**Impact:** ~1 error

### 5. app/api/demo/run/route.ts — Type Mismatch
```
error TS2322: Type '"local-installation"' not assignable to demo modes
```
**Fix:** Update demo mode types or remove incorrect value  
**Impact:** ~3 errors

---

## Nächster Schritt

### Round 2: lib/daemon/audit.ts

```
// Error:
import { assertScope } from "../scope.js";

// Fix needed:
// Create lib/scope.ts with assertScope export
```

Das ist ALFRET's nächste Selbst-Reparatur.

---

## Was Das Bedeutet

Ein Daemon, der sich selbst repariert:

1. **Identifiziert Fehler** (maid-scan-Prinzipien)
2. **Versteht Root-Causes** (evidence chains)
3. **Generiert Fixes** (PlannedWrite)
4. **Committet Changes** (mit Audit-Trail)
5. **Verifiziert Fixes** (npm run typecheck)
6. **Iteration bis OK**

Das ist nicht "Daemon, der selbst Code schreibt".  
Das ist **"Daemon mit Selbstheilungsfähigkeit"**.

---

## Metric: Error Reduction

| Round | Files Fixed | Errors Before | Errors After | % Reduction |
|-------|------------|----------------|--------------|-------------|
| 1 | lib/github.ts | 200 | 180 | 10% |
| 2 (next) | lib/daemon/audit.ts | 180 | ~175 | 2.7% |
| 3 (next) | lib/daemon/config.ts | 175 | ~167 | 4.5% |
| 4 (next) | bin/alfret-daemon.ts | 167 | ~137 | 18% |
| Target | All | 137 | 0 | 100% |

---

## ALFRET's Narration

```typescript
log.info(narrator.daemon.error({
  repository: "lootziffer666/alfret",
  detail: "20 TypeScript errors in fetchRepoEvidence",
  metric: "old ghFetch signature mismatch"
}));

// Output:
// "lootziffer666/alfret: Fehler in old ghFetch signature mismatch: 
//  20 TypeScript errors in fetchRepoEvidence. Das ist nicht erwartet. 
//  Das ist auch nicht deine Schuld. Das ist die Welt, die chaotisch ist. 
//  Ich versuche es nächsten Tick."

// After Fix:
log.info(narrator.general.nothing({
  repository: "lootziffer666/alfret",
  detail: "lib/github.ts now compiles"
}));

// Output:
// "Scan komplett. Keine Findings. Das bedeutet nicht 'alles ist 
//  perfekt.' Das bedeutet 'meine Heuristiken haben nichts gefangen.' 
//  Es könnte trotzdem kaputt sein."
```

---

## Das Wichtigste

**Vorher:**
- ALFRET: "Ich bin kaputt"
- Mensch: "Wer repariert dich?"
- ALFRET: "Keine Ahnung"

**Nachher:**
- ALFRET: "Ich bin kaputt. Hier ist was falsch. Ich repariere es."
- ALFRET: "Done. Nächster Fehler."

---

*ALFRET Self-Repair: Das ist keine Magie. Das ist Struktur.*

*Die Struktur, die ALFRET gebaut wurde, ermöglicht ALFRET, sich selbst zu reparieren.*

*Das ist der Plan.*
