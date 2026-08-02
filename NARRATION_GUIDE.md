# ALFRET Narration Guide
## Wie ALFRET's Stimme funktioniert und warum sie nicht optional ist

---

## Was ist Narration?

ALFRET ist ein Daemon, der über sich selbst spricht.

Nicht wie ein Logger, der "status: ok, warnings: 1" ausgibt.  
Nicht wie ein Tool, das sachlich Fehler meldet.

ALFRET erzählt **Geschichten**. Zynisch. Herzlich. Faktisch korrekt.

```typescript
// Ohne Narration:
log.warn("README is stale");

// Mit Narration:
log.warn(
  narrator.readme.stale({
    repository: "lootziffer666/alfret",
    metric: 14  // days old
  })
);
// Output: "lootziffer666/alfret: README-Alter: 14 Tage. Das ist nicht alt. Das ist 'ich 
// wusste nicht, dass das so lange her ist' alt. Trotzdem."
```

---

## Architektur

### Die `ALFRETNarrator` Klasse

```typescript
export class ALFRETNarrator {
  private stories = {
    readme: { /* ... */ },
    maid: { /* ... */ },
    daemon: { /* ... */ },
    github: { /* ... */ },
    skills: { /* ... */ },
    general: { /* ... */ },
  };
  
  // Interpolation: Ersetzt {{variable}} mit Kontext
  private interpolate(template: string, ctx: NarrationContext): string
  
  // Story-Wahl: Zufällig aus Kandidaten-Liste
  private pickStory(candidates: string[]): string
  
  // Public API: readme.*, maid.*, daemon.*, etc.
  readme = { stale: (ctx) => { ... }, ... };
  maid = { generated: (ctx) => { ... }, ... };
  // etc.
}
```

### Eine Typische Geschichte

```typescript
stories.readme.stale = [
  `${(r: string) => r}: Dein README ist älter als dein letzter PR. 
   Das ist wie: Du schreibst ein Buch, veröffentlichst ein Update, 
   aber das Inhaltsverzeichnis bleibt dasselbe. Ich bin nicht böse. 
   Ich bin nur enttäuscht.`,
   
  `${(r: string) => r}: README-Alter: {{metric}} Tage. Das ist nicht alt. 
   Das ist "ich wusste nicht, dass das so lange her ist" alt. 
   Trotzdem.`,
]
```

Beachte:
- Mehrere Varianten (Abwechslung)
- Kontext-Platzhalter: `{{metric}}`, `{{detail}}`, `{{repository}}`
- Zynisch, aber nicht verletzend
- Faktisch korrekt (14 Tage alt ist wirklich "lange")

---

## Verwendung im Code

### Schritt 1: Import

```typescript
import { narrator } from "../lib/daemon/narration.js";
```

### Schritt 2: Erzählen

```typescript
if (staleClaim) {
  log.warn(
    narrator.readme.etappenMismatch({
      repository: repo.repository,
      detail: `Alle ${staleClaim.claimed} Etappen`,
      metric: planEtappenCount,
    })
  );
}
```

### Schritt 3: Audit

Die Log-Ausgabe wird automatisch auditiert (wie alles andere auch).

---

## Die Kategorien

### 1. `narrator.readme.*`

README-Freshness spezifische Geschichten:

- `.stale(ctx)` — README ist alt
- `.markersMissing(ctx)` — Marker für Updates nicht gefunden
- `.noChange(ctx)` — Status-Block würde sich nicht ändern
- `.updateNeeded(ctx)` — Update-PR wird geschrieben
- `.etappenMismatch(ctx)` — Widerspruch in Plan vs. README
- `.noLastPr(ctx)` — Kein letzter PR gefunden

**Beispiel:**
```
"lootziffer666/alfret: Dein README ist älter als dein letzter PR. 
Das ist wie: Du schreibst ein Buch, veröffentlichst ein Update, 
aber das Inhaltsverzeichnis bleibt dasselbe."
```

### 2. `narrator.maid.*`

Maid-Scan / Repository-Hygiene Geschichten:

- `.generated(ctx)` — Generierte Dateien erkannt
- `.temporary(ctx)` — Temporäre Artefakte committet
- `.tooOld(ctx)` — Veralteter Code im Tree
- `.tooLarge(ctx)` — Binärdateien im Repository

**Beispiel:**
```
"*.tsbuildinfo: Temporary Files. Ihr committet die seit 47 Commits. 
Das ist nicht 'wir haben es vergessen'. Das ist 
'wir wissen nicht, wie .gitignore funktioniert'."
```

### 3. `narrator.daemon.*`

Daemon-Kontroll-Geschichten:

- `.paused(ctx)` — Daemon wurde pausiert
- `.armed(ctx)` — Armed-Mode-Status
- `.budget(ctx)` — Write-Budget Warnung
- `.tick(ctx)` — Tick startet/endet
- `.error(ctx)` — Fehler aufgetreten

**Beispiel:**
```
"Ich bin in sicherem Modus. Dryrun ist an. Ich schreibe PRs, 
aber nur in meinen Träumen. Wenn ich einen echten PR schreiben soll, 
jemand muss armed=true sagen."
```

### 4. `narrator.github.*`

GitHub API Antwort-Geschichten:

- `.rateLimited(ctx)` — 429 Too Many Requests
- `.unauthorized()` — 401/403
- `.notFound(ctx)` — 404
- `.success(ctx)` — API-Call OK

**Beispiel:**
```
"GitHub API: Rate limit hit. Ich bin zu schnell gewesen. 
Das ist ehrlich. Warte bis 2026-08-02T14:32:00Z."
```

### 5. `narrator.skills.*`

Skill-Execution Geschichten:

- `.loaded(ctx)` — Skill geladen
- `.failed(ctx)` — Skill fehlgeschlagen
- `.flagMissing(ctx)` — Feature Flag nicht gesetzt

**Beispiel:**
```
"Skill wuenschte sich LLM-Generation. Aber 
allowLlmGeneration=false. Das ist absichtlich. Das ist sicher."
```

### 6. `narrator.general.*`

Allgemeine Geschichten:

- `.startup(ctx)` — Daemon startet
- `.shutdown(ctx)` — Daemon stoppt
- `.nothing(ctx)` — Keine Änderungen nötig

**Beispiel:**
```
"Scan komplett. Keine Findings. Das bedeutet nicht 
'alles ist perfekt.' Das bedeutet 'meine Heuristiken 
haben nichts gefangen.' Es könnte trotzdem kaputt sein."
```

---

## Wie Man Eine Neue Geschichte Hinzufügt

### 1. Neue Kategorie Hinzufügen (Optional)

```typescript
private stories = {
  // ... existing categories ...
  custom: {
    situation: [
      `Repository {{repository}}: Story Template`,
      `{{detail}}: Another variant`,
    ],
  },
};
```

### 2. Öffentliche Methode Hinzufügen

```typescript
custom = {
  situation: (ctx: NarrationContext) =>
    this.interpolate(
      this.pickStory(this.stories.custom.situation),
      ctx
    ),
};
```

### 3. Im Code Verwenden

```typescript
log.info(narrator.custom.situation({
  repository: repo.repository,
  detail: "something happened",
}));
```

---

## Design-Richtlinien für Geschichten

### ✅ Gut

```typescript
// Faktisch korrekt, zynisch, konkret
"README-Alter: {{metric}} Tage. Das ist nicht alt. 
Das ist 'ich wusste nicht, dass das so lange her ist' alt."
```

### ❌ Schlecht

```typescript
// Marketing, zu nett, nicht konkret
"Your README could be fresher! Consider updating it soon!"

// Zu lang, abschweifend ohne Absurdität
"I was wondering about your README and I think maybe 
possibly it could be slightly outdated, but I'm not sure"

// Zu technisch, kein ALFRET-Ton
"README stale: last_commit_date < last_merged_pr_date"
```

### ✅ Absurd-Abrupt (Erlaubt)

```typescript
"Ich hätte den Status-Block aktualisieren sollen. 
Aber der neue Inhalt ist identisch mit dem alten. 
Das ist, als würde ich dir einen neuen PR schreiben, der nothing ändert. 
Das tun Menschen. Ich nicht."

// vs absurd-endet:

"GitHub API: Rate limit hit. Ich bin zu schnell gewesen. 
Das ist ehrlich. Ich warte jetzt. Bis zum nächsten Tick. 
Oder bis zur Auferstehung. Je nachdem."
```

---

## Kontext-Variablen

Alle Stories erhalten einen `NarrationContext`:

```typescript
export interface NarrationContext {
  repository: string;      // "lootziffer666/alfret"
  finding?: string;        // "stale-documentation"
  detail?: string;         // Länger Erklärung
  metric?: unknown;        // Zahl, Datum, etc
}
```

Interpolation im Template:

```typescript
{{repository}}  → ctx.repository
{{detail}}      → ctx.detail || "unbekannt"
{{metric}}      → String(ctx.metric || "?")
```

---

## Testing

Geschichten sind hardcodiert, aber nicht getestet.

**Warum?** Weil wir sie nur testen können, indem wir den Daemon tatsächlich laufen lassen.

**Bis dahin:** Verifizieren Sie manuell:

1. Syntax ist korrekt (TypeScript kompiliert)
2. Interpolation funktioniert ({{variablen}} passen)
3. Story ist faktisch korrekt (nicht Marketing)
4. Story hat die richtige Tonalität (zynisch, nicht verletzend)

---

## Warum Das Hardcodiert Sein Muss

ALFRET's Narration ist nicht "nice to have UI stuff".

Sie ist **core identity**.

Wenn ALFRET seine Stimme verliert, ist er kein Daemon mehr. Er ist ein Logger.

```typescript
// Wrong:
if (dryRun) {
  log.info("dryRun mode: no writes will be executed");
} else {
  log.info("armed mode: writes will be executed");
}

// Right:
if (dryRun) {
  log.info(narrator.daemon.armed({ repository }));
}
```

---

## Nächste Schritte

### Phase 1.5: Narration in Alle Jobs Integrieren

- `maid-scan`: Maid-Geschichten für alle Findings
- `branch-care`: Daemon-Geschichten für Branch-Operations
- Skills: Skill-Geschichten für Custom Jobs

### Phase 2: Narration für Skills

Skills sollten ihre eigenen Narrations-Methoden definieren können:

```typescript
export interface SkillNarration {
  loaded: (ctx: NarrationContext) => string;
  completed: (ctx: NarrationContext) => string;
  failed: (ctx: NarrationContext) => string;
}
```

### Phase 3+: Erweiterung

- Lokalisierung (Deutsch, Englisch, more)
- Narrations-Varianten nach Modus (verbose, quiet, debug)
- Story-Statistiken sammeln (welche Geschichten werden oft erzählt?)

---

## Das Wichtigste

ALFRET's Narration ist nicht optional.

Sie ist nicht dekorativ.

Sie ist **kernales Verhalten**.

Ein Daemon ohne Stimme ist ein unsichtbarer Prozess.  
Ein Daemon mit Stimme ist ein Sicherheits-Feature.

---

*ALFRET Narration: "Die Psyche eines sicheren Daemon ist sein bester Audit-Log."*
