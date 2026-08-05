// Ein einziger Ort, an dem das Operating Profile bestimmt wird.
//
// Vorher las der Route-Handler das Profil aus dem Request-Header
// `x-alfret-profile`. Das ist eine Eingabe des Aufrufers — und ausgerechnet die
// Werte "local-dev" und "homelab" schalten in lib/demo/policy.ts sämtliche
// Demo-Limits ab. Umgeht ein Request die Middleware (anderer Matcher, direkter
// Aufruf des Handlers, Rewrite), setzt der Aufrufer damit seine eigene Policy.
//
// Das Profil kommt deshalb aus der Serverumgebung. Der Header bleibt als reine
// Anzeige für den Client erhalten, aber niemand entscheidet mehr an ihm.
//
// Zweiter Fehler, den das mitschließt: Middleware und Handler benutzten zwei
// verschiedene Vokabulare ("public-demo"/"local-installation" gegen
// "local-dev"/"homelab"). Der Handler fiel deshalb IMMER auf "production"
// zurück, egal was die Middleware entschieden hatte.

import { operatingProfileSchema, type OperatingProfile } from "@/lib/schema/homelab";

export const DEFAULT_OPERATING_PROFILE: OperatingProfile = "production";

/**
 * Liest ALFRET_PROFILE aus der Serverumgebung.
 * Unbekannte oder fehlende Werte ergeben "production" — das strengste Profil.
 */
export function resolveOperatingProfile(
  env: Record<string, string | undefined> = process.env,
): OperatingProfile {
  const parsed = operatingProfileSchema.safeParse(env.ALFRET_PROFILE);
  return parsed.success ? parsed.data : DEFAULT_OPERATING_PROFILE;
}
