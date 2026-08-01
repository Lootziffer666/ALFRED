/**
 * Feature-Flags (Etappe 12c).
 *
 * Aus §8.9: Der CTA wechselt von "Lokale Version ansehen" zu
 * "ALFRET lokal installieren" sobald ein funktionsfähiger lokaler
 * Installer-Vertical-Slice besteht. Dieser Wechsel wird über einen
 * klaren Capability- oder Feature-Flag gesteuert — niemals durch
 * manuelle String-Änderung im UI.
 *
 * Flags werden über Umgebungsvariablen gesetzt. Kein Admin-UI,
 * kein Datenbank-backed Feature-Flagging-System — zu viel für
 * die aktuelle Etappe. Umgebungsvariablen sind reproducible,
 * deploybar und in Git nachvollziehbar.
 *
 * Namensschema: ALFRET_FLAG_<NAME>=1|true|yes
 */

export type FeatureFlag =
  | "local-installer-ready"   // Etappe 7 abgeschlossen und verifiziert — CTA wechselt
  | "demo-sandbox-enabled"    // Echte Web-Sandbox für /api/demo/run verfügbar
  | "codespace-demo-enabled"  // Codespace-Demo-Executor verfügbar
  | "workshop-live-events"    // Server-Sent Events für Raum IX (Etappe 13)
  | "mobile-pwa-enabled";     // Smartphone-PWA (Etappe 13)

type FlagState = "enabled" | "disabled" | "not-set";

/**
 * Liest einen Feature-Flag aus den Umgebungsvariablen.
 *
 * ALFRET_FLAG_LOCAL_INSTALLER_READY=1  → "local-installer-ready" ist enabled
 *
 * Konvention: Flag-Name → Uppercase, Bindestriche → Unterstriche, Präfix ALFRET_FLAG_
 */
export function readFlag(flag: FeatureFlag): FlagState {
  const envKey = `ALFRET_FLAG_${flag.toUpperCase().replace(/-/g, "_")}`;
  const value = process.env[envKey];

  if (value === undefined || value === "") return "not-set";
  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return "enabled";

  return "disabled";
}

export function isFlagEnabled(flag: FeatureFlag): boolean {
  return readFlag(flag) === "enabled";
}

// ── CTA-Logik ──────────────────────────────────────────────────────────────

export type CtaVariant =
  | "see-local-version"      // Kein Installer bereit — nur "Lokale Version ansehen"
  | "install-local-version"; // Installer bereit — "ALFRET lokal installieren"

/**
 * Gibt die aktuelle CTA-Variante zurück.
 *
 * Wechselt erst wenn ALFRET_FLAG_LOCAL_INSTALLER_READY=1 gesetzt ist.
 * Default ist immer "see-local-version" um versehentliche Upgrades zu verhindern.
 */
export function resolveCtaVariant(): CtaVariant {
  return isFlagEnabled("local-installer-ready")
    ? "install-local-version"
    : "see-local-version";
}

// ── CTA-Texte ──────────────────────────────────────────────────────────────

export interface CtaContent {
  headline: string;
  body: string;
  buttonText: string;
  buttonHref: string;
}

export function getCtaContent(variant: CtaVariant): CtaContent {
  switch (variant) {
    case "install-local-version":
      return {
        headline: "Das bietet ALFRET zusätzlich.",
        body: "Lokale Runner, private Repositories, Modellwahl, Hermes-Orchestrierung — vollständig auf deiner Hardware.",
        buttonText: "ALFRET lokal installieren",
        buttonHref: "/homelab/install",
      };
    case "see-local-version":
    default:
      return {
        headline: "Das bietet ALFRET zusätzlich.",
        body: "Lokale Runner, private Repositories, Modellwahl, Hermes-Orchestrierung — vollständig auf deiner Hardware.",
        buttonText: "Lokale Version ansehen",
        buttonHref: "/homelab",
      };
  }
}
