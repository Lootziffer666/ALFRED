/**
 * Plan §8.9 — der Bericht ist das Aufwärmprogramm, nicht das Produkt.
 *
 * Die Demo zeigt absichtlich nicht alles: was Zugangsdaten braucht oder auf
 * dem Daemon-Store liegt, wird von lib/profile/guards.ts zurückgehalten. Diese
 * Datei ist die andere Hälfte davon — sie sagt dem Leser, WAS zurückgehalten
 * wird, statt ihn gegen eine stumme 404 laufen zu lassen.
 *
 * Deshalb trägt jeder Eintrag die Routen, für die er steht. Ein Test
 * (tests/iceberg.test.ts) läuft über app/api und schlägt fehl, sobald eine
 * Route bewacht wird, die hier niemand erwähnt. So kann die Demo nicht
 * stillschweigend mehr einbehalten, als sie zugibt.
 *
 * Der CTA darf frech sein, aber nicht bluffen: solange kein Installer
 * Ende-zu-Ende bewiesen ist, führt er zu Information, nicht zu einer
 * Installation.
 */

export interface DemoCapabilities {
  /** A local installer exists and has been proven end-to-end. */
  localInstaller: boolean;
}

/**
 * Bewusst eine Konstante, kein Env-Flag: IcebergCta ist eine Client-Komponente.
 * Ein zur Laufzeit gelesenes process.env wäre auf dem Server gesetzt und im
 * Browser leer — der Knopf würde zwischen Server-Render und Hydration
 * springen. Umgelegt wird sie in Etappe 7, und nur wenn die vertikale Scheibe
 * wirklich läuft.
 */
export const DEMO_CAPABILITIES: DemoCapabilities = {
  localInstaller: false,
};

/** The real page the CTA can point at today. Replace when a product page exists. */
export const LOCAL_VERSION_URL = "https://github.com/Lootziffer666/ALFRED#readme";

export interface CtaSpec {
  headline: string;
  action: string;
  href: string;
  /** True once the CTA leads to an actual installation, not to information. */
  installs: boolean;
}

export const CTA_HEADLINE =
  "Was du hier gesehen hast, ist ALFRETs Aufwärmprogramm — der Teil, der ohne " +
  "Zugangsdaten und ohne Gedächtnis auskommt. Zu Hause hört er damit nicht auf.";

export function ctaFor(caps: DemoCapabilities = DEMO_CAPABILITIES): CtaSpec {
  return caps.localInstaller
    ? { headline: CTA_HEADLINE, action: "ALFRET lokal installieren", href: LOCAL_VERSION_URL, installs: true }
    : { headline: CTA_HEADLINE, action: "Lokale Version ansehen", href: LOCAL_VERSION_URL, installs: false };
}

export interface IcebergItem {
  title: string;
  detail: string;
  /**
   * Die bewachten API-Routen, für die dieser Eintrag steht. Leer heißt: das
   * Ding hat in der Demo überhaupt keine Oberfläche — es gibt nichts, wogegen
   * ein Besucher laufen könnte.
   */
  routes: readonly string[];
}

/** What the public report only hints at — the part below the waterline. */
export const ICEBERG_BELOW: readonly IcebergItem[] = [
  {
    title: "Private Repositories",
    detail:
      "Zu Hause liest ALFRET mit deinem Token auch, was nicht öffentlich ist. " +
      "Diese Instanz nimmt bewusst keine Zugangsdaten an — deine Schlüssel " +
      "gehören nicht auf einen fremden Server.",
    routes: ["/api/inspect", "/api/scout", "/api/audit", "/api/contract-map", "/api/models"],
  },
  {
    title: "Butler-Post",
    detail:
      "Ein Posteingang statt eines Berichts: offene Befunde, wartende " +
      "Schreibvorgänge, Eskalationen — gesammelt über Wochen statt über einen Aufruf.",
    routes: ["/api/attention"],
  },
  {
    title: "Projektkorpus",
    detail:
      "Eigene Repositories als verbindlicher Bestand, getrennt von Donors und " +
      "externen Funden — durchsuchbar, mit den Entscheidungen, die dazu führten.",
    routes: ["/api/decisions", "/api/search"],
  },
  {
    title: "Evidence Store",
    detail:
      "Befunde mit Commit, Pfad, Symbol, Artifact-Hash und Zeitpunkt statt nur " +
      "einer Quelle — jede Behauptung bis zur Zeile rückverfolgbar.",
    routes: ["/api/evidence/[id]"],
  },
  {
    title: "Architektur-Zeitachse",
    detail:
      "Wie das Repository wurde, was es ist: Wendepunkte über die Historie, " +
      "nicht nur der Zustand von heute.",
    routes: ["/api/timeline/[repository]"],
  },
  {
    title: "Selbstreparatur",
    detail:
      "Erkannte Befunde werden zu vorbereiteten Schreibvorgängen — freigegeben " +
      "wird trotzdem von dir, pro Repository und pro Aktion.",
    routes: ["/api/repair/[findingId]"],
  },
  {
    title: "Repo Maid & Daemon",
    detail:
      "Räumt Roots auf und hält Dokumentation und tatsächlichen Zustand " +
      "synchron — kontinuierlich, nicht auf Knopfdruck.",
    routes: [],
  },
  {
    title: "Refinery",
    detail: "Prüft PRs gegen eine frische Zielbasis und merged nur nach bestandenem Gate.",
    routes: [],
  },
  {
    title: "Raum IX · Werkstatt und Runner",
    detail:
      "Erkennt Geräte, plant Modelle und Runtimes auf die vorhandene Hardware " +
      "und bereitet Umgebungen auf freigegebenen Nodes vor — ohne beliebige Remote-Shell.",
    routes: [],
  },
];

/** Jede Route, die in der Demo zurückgehalten und hier benannt wird. */
export function namedRoutes(): Set<string> {
  return new Set(ICEBERG_BELOW.flatMap((i) => i.routes));
}
