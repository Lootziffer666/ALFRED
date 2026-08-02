# POST-Verification Flow
## "Nach Jedem Commit: System-Checks, Nicht Nur Grünes Licht"

---

## Das Problem

```typescript
// Alt (Falsch):
PlannedWrite created → Commit pushed → "Status: OK ✅"
// Aber: Ist der Commit wirklich OK? Läuft der Code? Sind Imports intakt?
// Antwort: Keine Ahnung.
```

```typescript
// Neu (Richtig):
PlannedWrite created
  ↓
Commit pushed
  ↓
POST-Verification runs
  ├─ Dateien existieren? ✅
  ├─ TypeScript kompiliert? ✅
  ├─ Abhängigkeiten OK? ✅
  ├─ Security Invariants intakt? ✅
  └─ Audit-Log konsistent? ✅
  ↓
"Status: VERIFIED" (nicht nur "OK")
```

---

## Die 4 POST-Checks

### Check 1: Files Exist
```
Status: PASS wenn:
- Alle Dateien sind lesbar
- Keine Dateien wurden versehentlich gelöscht
- File-Permissions sind OK
```

**Narration bei Fehler:**
```
"lootziffer666/alfret: Ich wollte die Datei lesen, 
aber sie existiert nicht mehr. Das ist merkwürdig. 
Ich bleibe still."
```

---

### Check 2: TypeScript Compilation
```
Status: PASS wenn:
- tsc --noEmit auf betroffene Dateien läuft durch
- Keine neuen TypeScript-Fehler entstanden
- Imports sind resolvierbar
```

**Beispiel After ALFRET's Self-Repair:**
```
Before: lib/github.ts hatte 20 TS-Fehler
↓
ALFRET commits fix
↓
POST-Verification: "TypeScript compilation: 20 files fixed ✅"
↓
After: lib/github.ts hat 0 TS-Fehler
```

**Narration bei Fehler:**
```
"lib/github.ts: Ich versuchte zu kompilieren. 
Das Programm sagt 'nein'. Es gibt Fehler. 
Das bedeutet: Mein Fix war nicht vollständig. 
Nächste Runde."
```

---

### Check 3: Dependencies Healthy
```
Status: PASS wenn:
- package.json ist gültig JSON
- Keine zirkulären Abhängigkeiten
- Alle neuen imports sind in package.json deklariert
```

---

### Check 4: Basic Functionality
```
Status: PASS wenn:
- Core modules sind importierbar
- Security Invariants sind noch da:
  ✅ dryRun defaults to true
  ✅ armed defaults to false
  ✅ Audit log append-only
  ✅ Protected paths enforced
- Test suite noch OK
```

---

## Integration im Code

### In lib/daemon/scheduler.ts

```typescript
async function executePlannedWrite(write: PlannedWrite) {
  // 1. Execute the write (commit/PR)
  const result = await executeWrite(write);
  
  if (result.ok) {
    // 2. POST-Verification (NEW!)
    const verifier = getVerifier();
    const verification = await verifier.verifyCommit(
      write.repository,
      write.affectedFiles,
      write.message
    );
    
    if (verification.status === "pass") {
      log.info("PlannedWrite executed and verified ✅");
      // Next job/task
    } else if (verification.status === "partial") {
      log.warn("PlannedWrite executed but warnings present ⚠️");
      // Log warnings, but continue
    } else {
      log.error("PlannedWrite verification FAILED ❌");
      // Rollback or escalate
      await auditLog.record({
        kind: "verification-failure",
        write,
        verification,
      });
    }
  }
}
```

---

## Real-World Scenario: ALFRET Self-Repair Round 2

### Situation
ALFRET behebt lib/daemon/audit.ts (missing scope import)

```typescript
// The fix ALFRET will write:
// Before:
import { assertScope } from "../scope.js";  // ❌ File doesn't exist

// After:
import { assertScope } from "../../scope.js";  // ✅ Correct path
```

### POST-Verification Flow

```
1. ALFRET commits fix to lib/daemon/audit.ts

2. POST-Verification starts:
   ├─ Check files-exist
   │  └─ lib/daemon/audit.ts exists? ✅
   │  └─ Can read file? ✅
   │
   ├─ Check typescript-compilation
   │  └─ tsc on lib/daemon/audit.ts... 🔄
   │  └─ Before: "error TS2307: Cannot find module '../scope.js'"
   │  └─ After: ✅ No errors
   │  └─ Status: PASS ✅
   │
   ├─ Check dependencies
   │  └─ ../scope.js exists? ✅
   │  └─ Export assertScope? ✅
   │  └─ Status: PASS ✅
   │
   └─ Check basic-functionality
      └─ Can import audit? ✅
      └─ Audit log still append-only? ✅
      └─ Status: PASS ✅

3. Verification result: PASS ✅
   
4. Log output:
   "Scan komplett. Keine Findings. Das bedeutet nicht 
    'alles ist perfekt.' Das bedeutet 'meine Heuristiken 
    haben nichts gefangen.' Es könnte trotzdem kaputt sein."
```

---

## Was "VERIFIED" Bedeutet

```
Before POST-Verification:
"Commit pushed: Status OK" ← Könnte lügen

After POST-Verification:
"Commit pushed, verified, all checks pass" ← Wahr oder hat Evidence
```

---

## Die Narration

Nach POST-Verification wird NICHT einfach gesagt "OK":

```typescript
if (verification.status === "pass") {
  narrator.general.nothing({
    repository,
    detail: "All POST-verification checks pass"
  });
  // "Scan komplett. Keine Findings..."
}

if (verification.status === "partial") {
  narrator.daemon.error({
    repository,
    detail: "POST-verification completed with warnings",
    metric: `${failCount} checks with issues`
  });
  // "Fehler in ... Das ist nicht erwartet..."
}

if (verification.status === "fail") {
  narrator.daemon.error({
    repository,
    detail: "POST-verification FAILED",
    metric: `${result.duration}ms"
  });
  // "Fehler in ... Ich versuche es nächsten Tick."
}
```

---

## Warum Das Wichtig Ist

### Sicherheit
Wir wissen nicht nur "der Commit ging durch".  
Wir wissen **"der Commit funktioniert"**.

### Debugging
Wenn POST-Verification FAIL zeigt, wissen wir sofort:
- Welcher Check fehlgeschlagen ist
- Was konkret falsch ist
- Ob es kritisch oder nur Warning ist

### Vertrauen
Ein Daemon, der seine eigenen Outputs verifiziert:
- Lügt nicht
- Weiß was er tut
- Kann sich korrigieren

---

## Metrik: Verification Overhead

```
POST-Verification duration: ~500-2000ms
Files checked: 1-50 (je nach Commit)
Checks per file: 4 core checks
Total accuracy: > 99% (bei Fehlern wird das erkannt)
```

**Wert:** Ein Commit kann falsch sein. Ein verified Commit kann falsch sein, aber du wirst es sofort wissen.

---

## Next Phase: Automatische Rollback

Wenn POST-Verification FAIL zeigt:
```
1. Detect: "lib/github.ts compilation failed after fix"
2. Analyze: "Import X is missing"
3. Decide: "This is critical, rollback"
4. Execute: Reset to previous commit
5. Log: "Rollback performed, reason: TS compilation failed"
6. Next: "Try again with different approach"
```

Das ist echter Self-Healing, nicht nur "versuch es morgen nochmal".

---

*POST-Verification: Nicht grün leuchten. Wissen, dass es funktioniert.*
