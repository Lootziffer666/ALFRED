// Wer ein Token schickt, gibt es aus der Hand.
//
// Fünf Routen nehmen ein GitHub-PAT oder einen Modell-API-Key im Request-Body
// entgegen und benutzen ihn serverseitig. Auf der eigenen Maschine ist das
// genau richtig — der Server ist der Rechner des Besitzers, und ohne Token
// sieht ALFRET keine privaten Repositories.
//
// Auf einer öffentlich erreichbaren Instanz ist es das Gegenteil: dort landet
// das Token eines Besuchers auf dem Server von jemand anderem. Es steht dann in
// dessen Request-Logs, in dessen Reverse-Proxy, in dessen Fehlermeldungen — und
// der Besucher hat davon nichts gesehen.
//
// /api/report zieht die Grenze bereits richtig ("takes no credentials by
// construction"). Diese Datei zieht sie für die übrigen Routen nach: Credentials
// nur in einem Profil, in dem Betreiber und Token-Besitzer dieselbe Person sind.
//
// Voreinstellung ist das strengste Profil. Wer die Instanz zu Hause betreibt,
// setzt ALFRET_PROFILE=homelab (oder local-dev) — die Fehlermeldung sagt das.

import { NextResponse } from "next/server";
import { resolveOperatingProfile } from "./operating";
import type { OperatingProfile } from "@/lib/schema/homelab";

/** Profile, in denen Betreiber und Token-Besitzer als dieselbe Person gelten. */
export function acceptsForeignCredentials(profile: OperatingProfile): boolean {
  return profile === "homelab" || profile === "local-dev";
}

/**
 * Gibt eine 403-Antwort zurück, wenn ein Request Credentials mitbringt, die
 * dieses Profil nicht annehmen darf. `null` heißt: der Request ist in Ordnung.
 *
 * Bewusst nur bei TATSÄCHLICH mitgeschicktem Geheimnis — eine Anfrage ohne
 * Token bleibt in jedem Profil erlaubt, sie liest dann nur Öffentliches.
 */
export function refuseForeignCredentials(
  present: Array<string | undefined | null>,
  profile: OperatingProfile = resolveOperatingProfile(),
): NextResponse | null {
  const carriesSecret = present.some((v) => typeof v === "string" && v.trim().length > 0);
  if (!carriesSecret) return null;
  if (acceptsForeignCredentials(profile)) return null;

  return NextResponse.json(
    {
      error:
        "Diese Instanz nimmt keine Zugangsdaten entgegen. Ein Token, das hier " +
        "ankommt, liegt auf dem Server des Betreibers, nicht auf deinem. " +
        "Ohne Token liest ALFRET öffentliche Repositories — für private " +
        "betreibe ALFRET selbst und setze ALFRET_PROFILE=homelab.",
      profile,
      reason: "credentials-not-accepted-in-this-profile",
    },
    { status: 403 },
  );
}
