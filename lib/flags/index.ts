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

// Die CTA-Logik lag früher hier — ein zweites, nie gerendertes System neben
// lib/report/capabilities.ts, mit eigenem Env-Flag, eigenen Texten und einem
// Knopf auf /homelab/install, eine Seite, die es nicht gibt. Zwei Quellen für
// dieselbe Aussage driften; capabilities.ts ist die, die tatsächlich rendert.

// plan §31 — Daemon Feature Flags (global, nie hardcodiert in Unit-Datei).
export interface DaemonFeatureFlags {
  allowLlmGeneration: boolean;
  allowAutoMerge: boolean;
  allowRefactoringProposals: boolean;
}

export const DEFAULT_DAEMON_FLAGS: DaemonFeatureFlags = {
  allowLlmGeneration: false,
  allowAutoMerge: false,
  allowRefactoringProposals: false,
};

export function createDaemonFlags(
  overrides: Partial<DaemonFeatureFlags> = {},
): DaemonFeatureFlags {
  return { ...DEFAULT_DAEMON_FLAGS, ...overrides };
}

export function isLlmGenerationAllowed(flags: DaemonFeatureFlags): boolean {
  return flags.allowLlmGeneration;
}

export function isAutoMergeAllowed(flags: DaemonFeatureFlags): boolean {
  return flags.allowAutoMerge;
}
