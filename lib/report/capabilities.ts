/**
 * Plan §8.9 — the call to action may be cheeky, but it must not bluff. Until a
 * local installer is proven end-to-end by the Windows vertical slice
 * (Etappe 7), the CTA points at information that actually exists, not at an
 * install flow that does not.
 */

export interface DemoCapabilities {
  /** A local installer exists and has been proven end-to-end. */
  localInstaller: boolean;
}

export const DEMO_CAPABILITIES: DemoCapabilities = {
  // Flipped in Etappe 7, and only once the vertical slice really runs.
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
  "Das bietet ALFRET zusätzlich: kontinuierliche Repo-Pflege, Refinery, lokale Ausführung, " +
  "private Projektkorpora, Homelab-Routing, Modellwahl und Agentenüberwachung.";

export function ctaFor(caps: DemoCapabilities = DEMO_CAPABILITIES): CtaSpec {
  return caps.localInstaller
    ? { headline: CTA_HEADLINE, action: "ALFRET lokal installieren", href: LOCAL_VERSION_URL, installs: true }
    : { headline: CTA_HEADLINE, action: "Lokale Version ansehen", href: LOCAL_VERSION_URL, installs: false };
}

/** What the public report only hints at — the part below the waterline. */
export const ICEBERG_BELOW: readonly { title: string; detail: string }[] = [
  { title: "Projektkorpus", detail: "Eigene Repositories als verbindlicher Bestand, getrennt von Donors und externen Funden." },
  { title: "Evidence Store", detail: "Befunde mit Commit, Pfad, Symbol, Artifact-Hash und Zeitpunkt statt nur einer Quelle." },
  { title: "Repo Maid", detail: "Räumt Roots auf, hält Dokumentation und tatsächlichen Zustand synchron." },
  { title: "Refinery", detail: "Prüft PRs gegen eine frische Zielbasis und merged nur nach bestandenem Gate." },
  { title: "Raum IX · Werkstatt", detail: "Erkennt Geräte, plant Modelle und Runtimes auf die vorhandene Hardware." },
  { title: "Runner", detail: "Bereitet Umgebungen auf freigegebenen Nodes vor — ohne beliebige Remote-Shell." },
];
