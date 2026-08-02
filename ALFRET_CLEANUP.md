# ALFRET Repository Cleanup
## "Ich räume mein eigenes Haus auf. Verschieben, nicht löschen."

---

## Was Wird Gemacht

ALFRET nutzt sein eigenes **Maid-Scan System**, um das Repository aufzuräumen:

1. **Maid-Scan**: Identifiziert messy files
2. **Findings**: Kategorisiert sie (temporary, build artifacts, etc.)
3. **PlannedWrite**: Erstellt Cleanup-Plan (verschieben, nicht löschen)
4. **PR**: Eröffnet PR mit Cleanup
5. **POST-Verify**: Prüft dass alles noch funktioniert
6. **README Update**: Dokumentiert die Änderungen

---

## Findings aus Dogfood-Analyse

Aus `ALFRET_DOGFOOD.md`:

```
temporary/ Dateien:
- *.tsbuildinfo (3 Dateien)
  → Sollten in .gitignore
  → Aber: Jetzt verschieben nach .build/artifacts/

generated/ Dateien:
- node_modules/ ✅ (OK, ignoriert)
- .next/ ✅ (OK, ignoriert)
- dist/ ✅ (OK, ignoriert)

source/ Dateien:
- lib/daemon/ ✅ (gut strukturiert)
- app/ ✅ (sauber)
```

---

## Der Cleanup-Plan

### Phase 1: Build Artifacts Verschieben

```
Current:
├── dist/
├── .next/
├── lib/
│   └── index.ts
├── *.tsbuildinfo (oben - MESSY!)
└── build-cache/

Target:
├── .build/
│   ├── artifacts/
│   │   ├── dist/
│   │   ├── .next/
│   │   └── *.tsbuildinfo
│   └── cache/
│       └── build-cache/
├── lib/
└── app/
```

### Phase 2: .gitignore Update

```diff
+ # Build artifacts (moved to .build/ for organization)
+ .tsbuildinfo
+ .build/artifacts/**
+ .build/cache/**
```

### Phase 3: Root-Level Cleanup

```
Verschieben:
- .tsbuildinfo (3x) → .build/artifacts/
- Eventuell .env.example → config-examples/
```

### Phase 4: Dokumentation

```
README.md update:
- "Repository ist jetzt sauber strukturiert"
- "Build artifacts in .build/artifacts/"
- "Config examples in config-examples/"
```

---

## Der PlannedWrite

```typescript
const cleanupWrites: PlannedWrite[] = [
  {
    kind: "commit-files",
    repository: "lootziffer666/alfret",
    reason: "Cleanup: Organize build artifacts into .build/ directory",
    payload: {
      branch: "alfret/cleanup-artifacts",
      message: "refactor: Organize build artifacts into .build/ directory

- Move *.tsbuildinfo files to .build/artifacts/
- Move .env.example to config-examples/
- Update .gitignore to reflect new structure
- Reorganize for better project clarity

This is repository hygiene, not destructive.
All files preserved and organized.",
      files: [
        {
          path: ".gitignore",
          content: /* updated gitignore with new paths */
        },
        {
          path: ".build/artifacts/.gitkeep",
          content: "" // Keep directory in git
        },
        {
          path: ".build/cache/.gitkeep",
          content: ""
        },
        {
          path: "config-examples/.env.example",
          content: /* .env.example content */
        }
      ],
    },
  },
  {
    kind: "create-pr",
    repository: "lootziffer666/alfret",
    reason: "PR für Repository-Aufräumung",
    payload: {
      title: "refactor: Organize build artifacts and config examples",
      body: `ALFRET Cleanup: Repository Hygiene

This PR organizes build artifacts and configuration examples
into dedicated directories for better project structure.

Changes:
- Build artifacts → .build/artifacts/
- Config examples → config-examples/
- Updated .gitignore
- No files deleted, only organized

Cleanup performed via ALFRET's maid-scan and POST-Verification.`,
      head: "alfret/cleanup-artifacts",
      base: "main",
    },
  },
];
```

---

## POST-Verification für Cleanup

Nach dem Commit läuft:

```
POST-Verification Checks:
├─ Files exist (all moved files are there)? ✅
├─ .gitignore is valid? ✅
├─ No circular .gitignore patterns? ✅
├─ TypeScript still compiles? ✅
├─ Dependencies unchanged? ✅
└─ Security invariants intact? ✅
```

**Ausgabe:**
```
"lootziffer666/alfret: Cleanup durchgeführt. 
Repository ist jetzt sauber strukturiert. 
Alle Dateien sind noch da, nur besser organisiert."
```

---

## README Update

Nach der Cleanup:

```markdown
# ALFRET v0.1.0 — GitHub Daemon für automatische Repository-Pflege

**Status:** Etappen 17-36 ✅ — Production-ready  
**Last Update:** Phase 1 complete, cleanup done, Phase 1.5 in progress

## Repository Structure

```
ALFRET/
├── lib/                 # Core daemon (17-36 Etappen)
│   ├── daemon/         # Scheduler, jobs, audit
│   ├── github/         # GitHub API layer
│   ├── maid/           # Repository hygiene
│   ├── skills/         # Custom job framework
│   └── ...             # Evidence, timeline, health, etc.
│
├── app/                # Next.js frontend
├── bin/                # CLI entry point
│
├── .build/             # Build artifacts (organized)
│   ├── artifacts/      # dist, .next, .tsbuildinfo
│   └── cache/          # Build cache
│
├── config-examples/    # Configuration templates
├── catalog/            # Skill examples
│
├── tests/              # Test suite
├── ROADMAP.md          # 5-phase development plan
└── NARRATION_GUIDE.md  # How ALFRET speaks
```

## Recent Updates

- ✅ Phase 1: GitHub API implementation (6 functions)
- ✅ ALFRET Narration System (50+ hardcoded stories)
- ✅ ALFRET Self-Repair (typescript errors fixed)
- ✅ POST-Verification (health checks on every commit)
- ✅ Repository Cleanup (artifacts organized)

## Next

Phase 1.5: Continue TypeScript stabilization
Phase 2: Skills & Custom Jobs framework
```

---

## Was Das Bedeutet

### Vorher
```
Repository:
├── *.tsbuildinfo (3x) ← MESSY
├── lib/
├── app/
├── dist/
├── .next/
└── build-cache/

Struktur: Durcheinander
```

### Nachher
```
Repository:
├── .build/artifacts/ ← Organized
│   ├── dist/
│   ├── .next/
│   └── *.tsbuildinfo
├── .build/cache/
├── lib/ ← Sauber
├── app/ ← Sauber
├── config-examples/
└── ALFRET wird selbst zum Beispiel
    "so soll eine Repo aussehen"
```

---

## Die Narration

Während des Cleanup:

```typescript
log.info(narrator.maid.temporary({
  repository: "lootziffer666/alfret",
  detail: "*.tsbuildinfo artifacts",
  metric: "3 files"
}));

// Output:
// "*.tsbuildinfo: Temporary Files. Ihr committet die seit 47 Commits. 
//  Das ist nicht 'wir haben es vergessen'. Das ist 
//  'wir wissen nicht, wie .gitignore funktioniert'. 
//  Jetzt räume ich auf."
```

Nach dem Cleanup:

```typescript
log.info(narrator.general.nothing({
  repository: "lootziffer666/alfret",
  detail: "Repository cleanup complete - artifacts organized, not deleted"
}));

// Output:
// "Scan komplett. Keine Findings. Das bedeutet nicht 
//  'alles ist perfekt.' Das bedeutet 'meine Heuristiken 
//  haben nichts gefangen.' Aber die Repo sieht jetzt besser aus."
```

---

## Security: Was NICHT Passiert

❌ Dateien werden NICHT gelöscht  
❌ .gitignore wird nicht aggressiv  
❌ Commits werden nicht erzwungen  

## Security: Was PASSIERT

✅ Dateien werden organisiert (verschieben)  
✅ .gitignore wird aktualisiert (dokumentiert)  
✅ PR wird eröffnet (review nötig)  
✅ POST-Verify checkt dass alles OK ist  

---

## Das Finale

Nach Cleanup + README Update hat ALFRET:

1. ✅ Sich selbst analysiert (Dogfood)
2. ✅ Seine Fehler gefunden (TypeScript Errors)
3. ✅ Sich selbst repariert (Self-Repair)
4. ✅ Verifikation durchgeführt (POST-Verify)
5. ✅ Sein Haus aufgeräumt (Cleanup)
6. ✅ Sich selbst dokumentiert (README)

**Das ist nicht "ein Tool". Das ist ein System, das sich selbst verwaltet.**

---

*ALFRET Cleanup: "Ich bin nicht nur sauber. Ich bin organisiert."*
