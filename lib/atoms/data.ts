import type { AtomCategory, Level, Phase, Rule, Signals } from "./types";

/**
 * Ported from the ALFRET "Raum VIII · Skriptorium" HTML prototype
 * (Alfred_new.html). The illumination levels, extraction rules and their
 * literary "tropes" are the actual content the prototype demonstrated —
 * kept verbatim (German) rather than rewritten, since the tone is the
 * point of the tool.
 */

export const LEVELS: Record<1 | 2 | 3 | 4, Level> = {
  1: {
    name: "Der Amtsarzt",
    open: "Ich habe mir das angesehen, und zunächst sah alles harmlos aus.",
    turn: "Unter der freundlichen Oberfläche sitzt allerdings ein Apparat, der bei jeder Pfütze erst die Zuständigkeit klärt.",
    close: "Bemerkenswert fleißig. Nur leider fleißig in einer Richtung, die niemand bestellt hat.",
    stil: "Schreibe wie ein Prüfer vom Finanzamt, der ein überraschend komplexes Puppentheater inspiziert: trocken, feinsinnig, leicht amüsiert. Workaround = Ausnahmegenehmigung, Refactor = Verwaltungsreform.",
  },
  2: {
    name: "Das Verfassungsgericht",
    open: "Sachstandsbericht zur Frage, ob dieses Repository noch Software oder bereits eine Verfassungsordnung ist.",
    turn: "Unterhalb der Oberfläche befindet sich keine Effektmaschine, sondern eine Verwaltungsordnung für Realität.",
    close: "Das Repo ist deshalb weniger ein Werkzeug als ein Weltmodell mit angeschlossener Beschwerdestelle.",
    stil: "Schreibe wie ein Richter an einem Verfassungsgericht für Softwarearchitektur. Komponenten = Behörden, Verträge = Staatsverträge, Commits/PRs = Grundsatzurteile. Begriffe: Verwaltungsakt, Vollziehbarkeit, Präzedenzfall, Geltungsbereich, Sezession.",
  },
  3: {
    name: "Der Existenzialist",
    open: "Jede Codebasis setzt ein Bild von Wahrheit voraus. Diese setzt gleich mehrere – und protokolliert ihren Zweifel daran.",
    turn: "Der interessante Punkt ist nicht, was der Code tut, sondern wozu er gezwungen ist, über Nicht-Wissen zu entscheiden.",
    close: "Hier wird Kausalität nicht angezeigt, sondern als Verpflichtung behandelt – eine selten ehrliche Form von Lüge-Verweigerung.",
    stil: "Schreibe wie ein Kulturphilosoph. Edge Cases = metaphysische Paradoxien, Fallbacks/UNKNOWN = epistemologische Entscheidungen. Begriffe: Epistemologie, Ontologie, Kausalität, Phänomenologie, Semantik vs. Syntax.",
  },
  4: {
    name: "Der Protokollant des Verfalls",
    open: "Diagnostisches Protokoll. Ich lese die Architektur wie eine Anamnese: jede Schicht ein überstandener Zwischenfall.",
    turn: "Die Kontrollmechanismen sind nicht paranoid ohne Grund – sie sind Narbengewebe um frühere Vertrauensbrüche.",
    close: "Prognose: stabil, solange niemand die Abwehrmechanismen als überflüssig streicht. Genau das wird irgendwann jemand versuchen.",
    stil: "Schreibe wie ein Psychiater für komplexe Softwaresysteme. Wrapper = Vertrauensverlust, übermäßige Validierung = Zwangsneurose, Guards = Abwehrmechanismen. Ton: diagnostisch, mit Mitgefühl.",
  },
};

function lc(...parts: string[]): string {
  return parts.join(" ").toLowerCase();
}

export const RULES: Rule[] = [
  {
    id: "single_file",
    cat: "authority",
    scan: (s: Signals) => {
      const t = lc(s.readme, s.conv);
      const ev = [];
      if (/single[- ]?file|eine (datei|index\.html)|index\.html.*runtime|kein build|no build|ohne build/.test(t))
        ev.push({ k: "README", v: "Single-File-Runtime, kein Build" });
      if (/nginx|lokaler server|local server/.test(t)) ev.push({ k: "README", v: "lokaler Server / Nginx" });
      return ev.length ? ev : null;
    },
    trope: {
      1: "Die Runtime steckt in einer einzigen Datei – sympathisch, kein Framework, das Node in der falschen Minderjährigkeitsstufe verlangt.",
      2: "Die eigentliche Laufzeit wohnt in einer einzigen Datei – charmant, und genau die Stelle, an der beschlossen wurde, dass eine Pfütze erst tragfähig ist, wenn fünf Instanzen zustimmen.",
      3: "Eine Welt in einer Datei stellt die Frage nach ihren Grenzen scharf: alles, was nicht drinsteht, muss Vertrag oder Vermutung sein.",
      4: "Single-File-Runtime ohne Build: ein kleines Herz, um das eine unverhältnismäßige Kontrollschicht wuchs – Kompensation durch Bürokratie.",
    },
  },
  {
    id: "constitution",
    cat: "authority",
    scan: (s: Signals) => {
      const t = lc(s.const, s.tree);
      const ev = [];
      if (/claude\.md|architecture\.md|rules?\.md|verfassung|invariante/.test(t))
        ev.push({ k: "Regel-Datei", v: "zentrale Verfassungs-/Regel-Datei" });
      if (/trauma|darf nie|nicht mehr zulässig|früher.*gescheitert/.test(s.const))
        ev.push({ k: "Regel-Datei", v: "Erwähnung früherer Zwischenfälle" });
      return ev.length ? ev : null;
    },
    trope: {
      1: "Es gibt eine Datei, die über jede Steckdose Buch führt. Offenbar hat das Projekt in seiner Jugend mehrere Integrationsunfälle erlebt.",
      2: "Die wichtigste Datei ist nicht die Runtime, sondern die Verfassung – Bauordnung und Sammlung gerichtlich bestätigter Traumata.",
      3: "Eine Config, die vergangene Fehler als bindendes Recht festhält, ist ein Gedächtnis, das sich weigert zu vergessen – Epistemologie als Versionskontrolle.",
      4: "Die Regel-Datei trägt die Struktur einer Angststörung: jeder Eintrag ein überstandener Schreck, zur Dauereinrichtung geworden.",
    },
  },
  {
    id: "monopoly",
    cat: "authority",
    scan: (s: Signals) => {
      const t = lc(s.const, s.conv, s.readme);
      const ev = [];
      if (/eine (wahrheit|quelle)|single source|cpu.*gpu.*gleich|dieselbe.*klassif|monopol|nicht.*eigene meinung/.test(t))
        ev.push({ k: "Vertrag", v: "monopolisierte Single-Source-of-Truth" });
      return ev.length ? ev : null;
    },
    trope: {
      1: "CPU und GPU dürfen keine eigene Meinung haben, was eine Fläche ist – sonst steinerne Fußspuren im Rasen. Seitdem: Zentralwahrheit.",
      2: "Materialwahrheit ist monopolisiert. Neue Komponenten denken sich nicht aus, was Gras ist – sie nutzen die bestehende Segmentierung oder einen formellen Korrekturweg.",
      3: "Zwei Wahrnehmungsinstanzen, die sich über die Natur einer Fläche einigen müssen, ist ein epistemischer Vertrag darüber, was 'real' heißen darf.",
      4: "Monopolisierte Klassifikation nach Divergenz: Isolation als Abwehr – 'zentralisiere ich die Deutungshoheit, widerspricht niemand mehr'.",
    },
  },
  {
    id: "marker",
    cat: "authority",
    scan: (s: Signals) => {
      const t = lc(s.conv, s.const);
      const ev = [];
      if (/pink|marker|overlay.*=|farbe.*=.*fenster|maske|konvention.*farbe/.test(t))
        ev.push({ k: "Konvention", v: "Farb-Marker als bindende Konvention" });
      return ev.length ? ev : null;
    },
    trope: {
      1: "Pink markierte Flächen sind Fenster. Nicht vielleicht. Fenster. Die Heuristik darf widersprechen, verliert aber.",
      2: "Pink ist ein Verwaltungsbescheid mit sofortiger Vollziehbarkeit. Die Heuristik hat eine Meinung; die Markierung ein Veto.",
      3: "Eine Farbe, die per Konvention über jeder Wahrscheinlichkeit rangiert, ist gesetzte Bedeutung – Semantik mit Vorrang vor Syntax.",
      4: "Hardcodierte Marker über der Heuristik: das System traut seiner Wahrnehmung nicht mehr und verlangt eine Unterschrift.",
    },
  },
  {
    id: "verify",
    cat: "adjudication",
    scan: (s: Signals) => {
      const t = lc(s.tree, s.conv);
      const ev = [];
      if (/verify|screenshot|pixel[- ]?diff|klassenzähl|tiefenschicht|konsolenfehler/.test(t))
        ev.push({ k: "tools/", v: "Screenshot-/Pixel-/Klassen-Forensik" });
      if (/geerbt|inherit.*light|beleuchtung.*vorgäng|previous.*scene/.test(t + s.commits))
        ev.push({ k: "Forensik", v: "prüft Zustands-Vererbung über Szenen" });
      return ev.length ? ev : null;
    },
    trope: {
      1: "Andere testen, ob eine Funktion true zurückgibt. Hier wird geprüft, ob die Welt die Beleuchtung ihres verstorbenen Vorgängers geerbt hat.",
      2: "tools/ ist die interne Revision: Screenshots, Pixelunterschiede, Klassenzählungen, die Frage nach fremdem Licht.",
      3: "Eine Suite, die Identität über Zeit prüft, ist ein Gedächtnistest – die Maschine überprüft ihre eigene Kontinuität.",
      4: "Übermäßige visuelle Forensik ist Misstrauen: das System glaubt seinem Zustand nicht und verlangt bei jedem Wechsel einen Abgleich.",
    },
  },
  {
    id: "oracle",
    cat: "adjudication",
    scan: (s: Signals) => {
      const t = lc(s.commits, s.tree, s.conv);
      const ev = [];
      if (/oracle|determinist|scheduler.*oracle|reihenfolge.*zuläss/.test(t))
        ev.push({ k: "Commit/Code", v: "deterministisches Scheduler-Orakel" });
      return ev.length ? ev : null;
    },
    trope: {
      1: "Andere Repos haben Tests. Dieses hat ein Orakel – eine Instanz, die entscheidet, ob die Entstehung in zulässiger Reihenfolge erfolgte.",
      2: "Ein Commit führt ein Orakel ein, das Render-Pässe deterministisch plant – kein Test, sondern eine richterliche Instanz über die Entstehungsordnung.",
      3: "Determinismus als Orakel hebt 'darf dieser Zustand so entstehen?' von der Berechnung ins Urteil – Kausalität unter Aufsicht.",
      4: "Ein 'Orakel' statt eines Tests ist ein Alarm: das Team vertraut Vorhersagen nicht mehr und verlangt eine autoritative Stimme.",
    },
  },
  {
    id: "unknown",
    cat: "epistemic",
    scan: (s: Signals) => {
      const t = lc(s.conv, s.commits, s.const);
      const ev = [];
      if (/\bunknown\b|free.*occupied|surface.*occupied|nicht.*wissen|weiß.*nicht|unsicherheit.*valide/.test(t))
        ev.push({ k: "Code/Commit", v: "expliziter UNKNOWN-Zustand" });
      return ev.length ? ev : null;
    },
    trope: {
      1: "Das Repo darf offiziell sagen: ich weiß es nicht. Viele würden Geometrie mit Selbstvertrauen erfinden – hier gibt es einen Unbekannt-Zustand.",
      2: "FREE / SURFACE-OCCUPIED / UNKNOWN – eine der reifsten Entscheidungen: Unsicherheit als valide Information, nicht als zu schließende Lücke.",
      3: "Ein System, das UNKNOWN erstklassig führt, hat verstanden: Nicht-Wissen ist keine Leere, sondern eine ehrliche Aussage.",
      4: "Der UNKNOWN-Zustand ist das gesunde Ventil in einer kontrollzwanghaften Architektur – er verhindert, dass die Abwehr in Halluzination umschlägt.",
    },
  },
  {
    id: "melderecht",
    cat: "authority",
    scan: (s: Signals) => {
      const t = lc(s.conv, s.commits, s.const);
      const ev = [];
      if (/kein setscale|remove.*reinsert|entfernt.*neu|abmelden.*anmelden|keine.*methode.*größe/.test(t))
        ev.push({ k: "API/Konv", v: "kein Setter; Größe nur über remove + reinsert" });
      return ev.length ? ev : null;
    },
    trope: {
      1: "Gibt es keine Methode zum Ändern der Größe, wird kein Wert verändert – der Actor wird entfernt und neu eingesetzt. Kontinuität nicht unterstützt.",
      2: "Deutsches Melderecht für Figuren: 1,0 möchte 1,2 sein – dafür erst abmelden, dann als vergrößerte Neuanmeldung erfassen.",
      3: "Ein Objekt, das seine Größe nur durch Vernichtung und Neuschöpfung ändern darf, kennt keine Identität über Veränderung – Werden statt Sein.",
      4: "Fehlender Setter, erzwungener remove/reinsert: Misstrauen gegenüber teilweisen Zuständen – jede Änderung ein sauberer Neuanfang.",
    },
  },
  {
    id: "realm",
    cat: "epistemic",
    scan: (s: Signals) => {
      const t = lc(s.commits, s.conv, s.const);
      const ev = [];
      if (/realm|instanceof.*fail|typed array.*ander|cross[- ]?realm|grenz|identität.*nicht.*an/.test(t))
        ev.push({ k: "PR/Code", v: "Identitäts-Bruch über Realm-Grenzen" });
      return ev.length ? ev : null;
    },
    trope: {
      1: "Zwei Objekte waren technisch dasselbe, kamen nur aus verschiedenen Verwaltungsbezirken – das System erkannte ihre Identität nicht an. Grenzpolitik.",
      2: "Typed Arrays aus dem Editor-Realm wurden nicht als ihres erkannt – eine Identitätsfrage, die an der Herkunft scheitert.",
      3: "Wenn Gleichheit an der Kontext-Zugehörigkeit scheitert, ist 'ist dasselbe wie' keine Eigenschaft der Dinge mehr, sondern der Grenzen – Ontologie als Zoll.",
      4: "Cross-Realm-Brüche, die zu Guards führen, sind Narben: einmal betrogen von etwas, das aussah wie es selbst – seither Passkontrolle.",
    },
  },
  {
    id: "recursive",
    cat: "epistemic",
    scan: (s: Signals) => {
      const t = lc(s.commits, s.conv);
      const ev = [];
      if (/rekursiv|editor.*in.*editor|embed.*embed|sich.*selbst.*als.*inhalt|wartebereich.*innerhalb/.test(t))
        ev.push({ k: "PR", v: "rekursive Einbettung" });
      return ev.length ? ev : null;
    },
    trope: {
      1: "Ein Editor-Link lud im eingebetteten Editor einen weiteren Editor – durch eine Tür und wieder im Wartebereich, diesmal innerhalb des Formulars.",
      2: "Die Oberfläche stellte ihre eigene Oberfläche als Inhalt dar – eine rekursive Behörde, die ihre Laufzeit durch sich selbst ersetzte.",
      3: "Ein System, das sich als eigenen Inhalt liest, ist ein Spiegel, der einen Spiegel spiegelt – Darstellung und Dargestelltes geben die Unterscheidung auf.",
      4: "Rekursive Einbettung als Vorfall: die Grenze zwischen Werkzeug und Werkstück kollabierte – seitdem doppelt bewacht.",
    },
  },
  {
    id: "inherit",
    cat: "causality",
    scan: (s: Signals) => {
      const t = lc(s.commits, s.conv, s.const);
      const ev = [];
      if (/beleuchtung.*erben|fremdes licht|szene.*b.*szene.*a|cache.*zustand|vorgängerin|familiär/.test(t))
        ev.push({ k: "PR/Forensik", v: "Szenen vererbten Licht/Zustand" });
      return ev.length ? ev : null;
    },
    trope: {
      1: "Eine Szene kann fremdes Licht erben – sie trägt den Sonnenstand ihrer Vorgängerin. Der Renderpfad nennt es Cache; die Landschaft familiäre Belastung.",
      2: "Beleuchtungs-Isolation wurde Invariante: Szene B darf nicht mit dem Licht von A leben – ein abgeschafftes Erbrecht.",
      3: "Zustand, der das Ende seiner Ursache überdauert, ist das technischste Bild von Trauma: die Wirkung weigert sich, die Ursache zu vergessen.",
      4: "Vererbte Beleuchtung → explizite Isolation: ein Flashback-Mechanismus, gegen den das System eine Abschottung baut.",
    },
  },
  {
    id: "semantic",
    cat: "causality",
    scan: (s: Signals) => {
      const t = lc(s.commits, s.conv, s.const);
      const ev = [];
      if (/optisch.*nicht.*physisch|nur.*aussieht.*oder.*ist|zustände.*statt.*schalter|adapter.*ebene|ehrlich.*ebene/.test(t))
        ev.push({ k: "PR/Vertrag", v: "optische ≠ physische Verformung; Zustände statt Flags" });
      return ev.length ? ev : null;
    },
    trope: {
      1: "Optische Verformung darf nicht als physische ausgegeben werden – das Repo verlangt von Software, woran Menschen scheitern: ehrlich sagen, ob etwas nur so aussieht oder so ist.",
      2: "Der semantische Projektionsvertrag übergibt Zustände und Verpflichtungen, nicht Schalter – und verlangt die Ebene, auf der ein Ergebnis existiert.",
      3: "'Erscheint so' vs. 'ist so' als Vertrag ist Phänomenologie in Produktion: das System weigert sich, Schein und Sein zu verwechseln.",
      4: "Die obsessive Trennung von Darstellung und Physik ist Abwehr gegen die eigene Tendenz zu lügen – Schönheit nicht für Wahrheit auszugeben.",
    },
  },
  {
    id: "worldlaws",
    cat: "causality",
    scan: (s: Signals) => {
      const t = lc(s.readme, s.conv, s.const);
      const m = t.match(/(\d{2,3})\s*(sichtbare\s*)?(weltgesetze|regeln|laws|gesetze)/);
      const ev = [];
      if (m) ev.push({ k: "Katalog", v: `${m[1]} katalogisierte Weltgesetze` });
      if (/sichtbar.*mechanisch|mechanisch.*sichtbar|konsequenz.*trägt|effekt.*ohne.*konsequenz/.test(t))
        ev.push({ k: "Prinzip", v: "sichtbar ⇔ mechanisch" });
      return ev.length ? ev : null;
    },
    trope: {
      1: "Ein Katalog aus sechzig Weltgesetzen. Sechzig. Die Bundesrepublik startete mit weniger Garantien. Jede Information braucht Herkunft, Lebensdauer, demnächst ein Widerspruchsformular.",
      2: "Shader sind nicht Deko, sondern die Grammatik der Welt. Ein Effekt ohne Konsequenz gilt als unvollständig.",
      3: "Sechzig Regeln, die Sichtbarkeit an mechanische Folge binden, buchführen Kausalität vollständig – nichts geschieht einfach, alles wird zugerechnet.",
      4: "Ein 60-Punkte-Katalog ist Kontrollkompensat: je mehr die Simulation zu lügen droht, desto mehr Regeln füllen jede Lücke mit Verantwortung.",
    },
  },
  {
    id: "commit_precedent",
    cat: "adjudication",
    scan: (s: Signals) => {
      const ev: { k: string; v: string }[] = [];
      const hit = s.commits
        .split(/\n/)
        .filter((l) => /invariante|vertragslücke|drift.*beseitigt|grundsatz|oracle|eine materialschicht|ziel statt format|präzedenz/i.test(l));
      hit.slice(0, 3).forEach((l) => ev.push({ k: "Commit", v: `„${l.trim().slice(0, 44)}"` }));
      return ev.length ? ev : null;
    },
    trope: {
      1: "Die Commit-Titel lesen sich wie Leitsätze. „Drift wurde beseitigt.\" So klingt jemand, der um 02:17 sagte: das darf nie wieder passieren.",
      2: "Die Commit-Historie ist Rechtsprechung – jeder Titel ein Grundsatzurteil, welche Annahme künftig unzulässig ist.",
      3: "Commit-Messages als normative Sätze zeigen ein System, das seine Geschichte als bindendes Recht liest – Erinnerung mit Gesetzeskraft.",
      4: "Die Präzedenz-Sprache ist Warnsignal: vergangene Schmerzen codiert als unverhandelbare Regeln – jedes Trauma zur Vorschrift erstarrt.",
    },
  },
  {
    id: "pr_tribunal",
    cat: "adjudication",
    scan: (s: Signals) => {
      const ev: { k: string; v: string }[] = [];
      const hit = s.commits.split(/\n/).filter((l) => /pr\s*#?\d|review.*festgestellt|untersuchung|anhörung/i.test(l));
      hit.slice(0, 3).forEach((l) => ev.push({ k: "PR", v: l.trim().slice(0, 44) }));
      return ev.length ? ev : null;
    },
    trope: {
      1: "Die Pull Requests sind öffentliche Anhörungen – Vögel verlieren ihr Recht, im Flug Schlammspuren zu hinterlassen.",
      2: "PRs sind Untersuchungsausschüsse: Verfahren, die klären, wer im Streitfall recht hat und welche Ableitung künftig verboten ist.",
      3: "Jeder PR, der eine 'falsche Annahme über die Wirklichkeit' protokolliert, ist ein erkenntnistheoretischer Zwischenfall in Regel gegossen.",
      4: "Die Dichte an PRs, die 'falsche Menschenbilder' korrigieren, zeichnet ein System im Dauer-Krisenmodus: jede Review ein dokumentierter Zusammenbruch.",
    },
  },
];

export const CATMETA: Record<AtomCategory, { color: string; row: number }> = {
  authority: { color: "#b78a3e", row: 0 },
  causality: { color: "#4dc9c0", row: 1 },
  adjudication: { color: "#7fae6a", row: 2 },
  epistemic: { color: "#9aa0ad", row: 3 },
};

export const PHASES: Phase[] = [
  { key: "schein", title: "Der Schein der Oberfläche", lvlKey: "open", pick: ["single_file"] },
  { key: "verfass", title: "Die Verfassung", lvlKey: null, pick: ["constitution", "monopoly", "marker", "melderecht"] },
  { key: "behörd", title: "Die Behördenstruktur", lvlKey: null, pick: ["verify", "oracle", "commit_precedent", "pr_tribunal"] },
  { key: "para", title: "Paradoxa & ehrliches Nicht-Wissen", lvlKey: null, pick: ["unknown", "realm", "recursive", "inherit", "semantic", "worldlaws"] },
  { key: "quint", title: "Quintessenz", lvlKey: "close", pick: [] },
];

export const WARN: Record<1 | 2 | 3 | 4, string> = {
  1: "Dies ist kein Effekt-Editor. Das ist ein Puppentheater, das heimlich ein Finanzamt betreibt.",
  2: "Dies ist kein Effekt-Editor. Änderungen an der Wirklichkeit sind ausschließlich über den vorgesehenen Kanalvertrag einzureichen.",
  3: "Dies ist kein Effekt-Editor. Es ist ein Apparat, der einem Bild beibringt, für seine Erscheinung Verantwortung zu tragen.",
  4: "Dies ist kein Effekt-Editor. Es ist ein überlebendes System – behandeln Sie seine Abwehrmechanismen nicht als überflüssig.",
};

/** Demo signals for the "SHADED" example repository used by the original prototype. */
export const SHADED_SIGNALS: Signals = {
  readme:
    "SHADED verwandelt ein einzelnes Bild in eine lebendige Welt: Wetter, Tageszeiten, Nässe, Sturm, Nebel, Schnee, Feuer, Verfall, Frühling. Fußspuren, Laub, Lagerfeuer. Katzen, Monster, Stadtbewohner, Helden als optische Gäste. Single index.html Runtime, kein Build, lokaler Server oder Nginx. 60 sichtbare Weltgesetze: sichtbar hat mechanische Konsequenz, mechanisch hinterlässt sichtbare Spur; Effekt ohne Konsequenz ist unvollständig.",
  const:
    "CLAUDE.md: Die Runtime bleibt eine Datei. Der Editor dupliziert nicht die Engine. window.SHADED ist ein Vertrag. CPU und GPU verwenden dieselbe Materialwahrheit – eine Material-Wahrheit, weil ein früherer Prototyp scheiterte, als die CPU Gras erkannte und die GPU Stein. Neue Komponenten denken sich nicht selbst aus, was Gras ist. Darf nie wieder passieren.",
  tree:
    "README.md\nindex.html\nCLAUDE.md\neditor/facade.js\neditor/markerPainter.js\neditor/actorPlacer.js\ncontracts/shaded.scene-project.json\ntools/verify.js\ntools/verify-editor.js\ntools/verify-actors.js\ntools/verify-intrinsic.js\ntools/verify_traces.js\ndocs/weltgesetze.md\nrendergraph/\nintegrations/",
  commits:
    "Ziel statt Format: Backend-Wahl ist keine Invariante.\nVertragslücke geschlossen: externes Shading-Feld über die CLI.\nORCHESTRATION.md ist das Bridge-Muster – Drift beseitigt.\nEine Materialschicht: Licht und Material trennen.\nAdd deterministic rendergraph scheduler oracle.\nPR #31 versionierter Vertrag + Headless-Orchestrierung\nPR #34 oberflächenspezifische Spuren\nPR #38 FREE / SURFACE-OCCUPIED / UNKNOWN\nPR #39 Licht und Material trennen\nPR #43 semantischer Projektionsvertrag",
  conv:
    "pink übermalte Stellen = Fenster (Heuristik hat kein Veto). window.SHADED = einziges API; kein setScale, Actor wird entfernt und neu eingesetzt. UNKNOWN/FREE/SURFACE-OCCUPIED statt erfundener Geometrie. Typed Arrays aus Editor-Realm nicht erkannt (cross-realm). Editor-Link lud im Editor einen zweiten Editor (rekursiv). Szene B erbte Beleuchtung von Szene A. Optische Verformung darf nicht als physische ausgegeben werden.",
};

export const EMPTY_SIGNALS: Signals = { readme: "", const: "", tree: "", commits: "", conv: "" };
