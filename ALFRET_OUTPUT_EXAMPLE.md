# ALFRET Daemon: Beispiel-Ausgaben
## Wie ALFRET Spricht (Wenn Er Laufen Würde)

---

## Szenario 1: README ist veraltet, Doku-Relevant geändert

```
[DAEMON] Starting tick 42 on lootziffer666/alfret
[INFO] v0.1.0 is running. lootziffer666/alfret. Zynismus level: MAX. Bereitschaft: Theoretisch.

[JOB] readme-freshness starting...

[WARN] lootziffer666/alfret: README ist veraltet. Doku-relevantes hat sich geändert. Ich schreibe gleich einen PR. Das wird schmerzen. Aber weniger als das Gegenteil.

[JOB] Generating PlannedWrite: commit to alfret/readme-freshness-1722614400000
[JOB] Opening PR #47 for README status update
[RESULT] readme-freshness: status=ok, findings=1 (doc-update-needed), writes=2 (commit+PR)

[TICK] Tick 42 complete. Processed 1 job, created 1 PR, rate limit: 58/60
```

---

## Szenario 2: Etappen-Mismatch Erkannt

```
[DAEMON] Starting tick 13 on lootziffer666/alfret

[JOB] readme-freshness starting...

[WARN] lootziffer666/alfret: Dein README sagt "Alle 11 Etappen sind fertig". PLAN.md sagt was anderes. Das ist wie: Du sagst dir selbst, dass es 11 Uhr ist. Aber die Uhr zeigt 36. Einer von euch lügt. Wahrscheinlich ist es du.

[FINDING] stale-documentation warning: README behauptet "11 Etappen", PLAN.md zeigt 36.

[INFO] lootziffer666/alfret: Ich hätte gerne einen Status-Block aktualisiert. Aber die Marker fehlen. Das ist, als würde ich dir einen Brief schreiben, aber der Umschlag hat keine Adresse. So mache ich einfach... nichts. Und warte.

[RESULT] readme-freshness: status=ok, findings=2, writes=0

[TICK] Tick 13 complete. No changes needed.
```

---

## Szenario 3: Kein Letzter PR Gefunden

```
[JOB] readme-freshness starting...

[INFO] lootziffer666/alfret: Ich wollte schauen, wann der letzte PR war. Aber es gibt keinen. Das bedeutet: Entweder du hast dieses Repo gerade erstellt, oder du schreibst nur auf main. Beides ist komisch.

[RESULT] readme-freshness: status=ok (no prior PR), findings=0, writes=0
```

---

## Szenario 4: README Frisch, Keine Änderungen Nötig

```
[JOB] readme-freshness starting...

[INFO] lootziffer666/alfret: Scan komplett. Keine Findings. Das bedeutet nicht "alles ist perfekt." Das bedeutet "meine Heuristiken haben nichts gefangen." Es könnte trotzdem kaputt sein.

[RESULT] readme-freshness: status=ok, findings=0, writes=0

[INFO] Tick 99 complete. All systems nominal (or so it seems).
```

---

## Szenario 5: README Veraltet, Aber Keine Doku-Änderungen

```
[JOB] readme-freshness starting...

[INFO] lootziffer666/alfret: Ich hätte den Status-Block aktualisieren sollen. Aber der neue Inhalt ist identisch mit dem alten. Das ist, als würde ich dir einen neuen PR schreiben, der nothing ändert. Das tun Menschen. Ich nicht.

[FINDING] stale-documentation info: README ist älter als der letzte PR, aber nichts Doku-Relevantes wurde berührt.

[RESULT] readme-freshness: status=ok, findings=1 (info only), writes=0
```

---

## Szenario 6: GitHub API Rate-Limited

```
[JOB] readme-freshness starting...

[ERROR] GitHub API: Rate limit hit. Ich bin zu schnell gewesen. Das ist ehrlich. Warte bis 2026-08-02T14:32:00Z.

[API] POST /repos/lootziffer666/alfret/pulls failed: 429 Too Many Requests

[RESULT] readme-freshness: status=error, findings=0, writes=0

[TICK] Rescheduling next tick for rate-limit reset time.
```

---

## Szenario 7: Daemon Pausiert

```
[DAEMON] Reading pause status...

[WARN] PAUSED-Datei existiert. Ich stoppe. Das ist nicht dramatisch. Das ist vorhersehbar. Jemand hat mich gebremst. Wahrscheinlich mit gutem Grund.

[DAEMON] Shutdown initiated.
[INFO] Herunterfahren. lootziffer666/alfret. Ich war hier. Ich habe Dinge beobachtet. Ich konnte nichts ändern. Aber ich habe es versucht. Metaphorisch.

[DAEMON] Bye.
```

---

## Szenario 8: Maid-Scan mit Findings

```
[JOB] maid-scan starting...

[WARN] lootziffer666/alfret: *.tsbuildinfo: Temporary Files. Ihr committet die seit 47 Commits. Das ist nicht "wir haben es vergessen". Das ist "wir wissen nicht, wie .gitignore funktioniert".

[FINDING] temporary-files: *.tsbuildinfo should be in .gitignore

[WARN] lootziffer666/alfret: Ich habe 3 generierte Dateien gefunden (node_modules, .next, dist). Die sind normalweise. Aber .yarn/patches ist auch darin. Das sollte es nicht sein.

[RESULT] maid-scan: status=ok, findings=2, writes=0
```

---

## Was Diese Ausgaben NICHT Sind

❌ **Nicht random.** Jede Geschichte passt zur Situation.  
❌ **Nicht dekorativ.** Jede Zeile kommuniziert Information.  
❌ **Nicht Marketing.** ALFRET ist zynisch, aber ehrlich.  
❌ **Nicht englisch.** ALFRET spricht Deutsch (wie sein Repo).  

---

## Was Diese Ausgaben SIND

✅ **Faktisch korrekt.** Die Geschichten sind wahr.  
✅ **Hardcodiert.** Nicht optional, nicht konfigurierbar.  
✅ **Narrative.** ALFRET hat eine Persönlichkeit.  
✅ **Verfolgt den Audit-Trail.** Jede Geschichte ist auch ein Log-Entry.  

---

## Warum Das Wichtig Ist

Ein Daemon ohne Persönlichkeit ist ein Black Box. Du fragst: "Was macht der Daemon?"  
Antwort: *Stille*.

Ein Daemon mit ALFRET's Stimme sagt dir, was er denkt:
- "Ich fand einen Bug. Ich sage dir, was ich fand."
- "Ich wollte einen PR schreiben, aber die Marker sind weg. Jetzt warte ich."
- "Du hast 47 Commits lang *.tsbuildinfo committet. Das ist peinlich."

Das ist nicht nice-to-have. Das ist debugging.

---

## Technische Implementierung

```typescript
import { narrator } from "../lib/daemon/narration";

// Im readme-freshness Job:
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

Jede `.narration.*()` Methode:
- Wählt eine zufällige Geschichte aus einer Liste
- Interpoliert Kontext (`{{repository}}`, `{{metric}}`, etc.)
- Gibt einen String zurück
- Der String wird geloggt (und damit auch auditiert)

---

*ALFRET Narration: Nicht optional. Nicht konfigurierbar. Core feature.*
