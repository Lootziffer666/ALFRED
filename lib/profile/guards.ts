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

// ── Persistenz ───────────────────────────────────────────────────────────────
//
// Die Demo ist flüchtig: sie liest ein öffentliches Repository, setzt daraus
// einen Bericht, und danach ist nichts übrig. Der Daemon-Store ist das
// Gegenteil — ~/.alfret/store.db hält Findings, geplante Schreibvorgänge,
// Zeitachsen, Korpus-Entscheidungen und das Audit-Log über die Repositories
// des BETREIBERS, über Wochen hinweg.
//
// Sechs Routen greifen darauf zu, und keine war an ein Profil gebunden. Auf
// einer öffentlich erreichbaren Instanz gab damit jeder Aufruf von
// /api/attention den Posteingang des Betreibers heraus, /api/timeline seine
// Repository-Historie, und POST /api/repair legte sogar neue Einträge an.
//
// Das ist keine Demo-Funktionalität. Es ist das Homelab.

/** Profile, in denen der persistente Daemon-Store bedient wird. */
export function servesHomelabRoutes(profile: OperatingProfile): boolean {
  return profile === "homelab" || profile === "local-dev";
}

/**
 * Gibt 404 zurück, wenn eine Homelab-Route in einem flüchtigen Profil
 * angefragt wird. `null` heißt: die Route darf bedienen.
 *
 * 404 statt 403, weil auf einer Demo-Instanz nicht einmal die Existenz eines
 * Homelab-Postfachs eine öffentliche Information ist.
 */
export function refuseOutsideHomelab(
  profile: OperatingProfile = resolveOperatingProfile(),
): NextResponse | null {
  if (servesHomelabRoutes(profile)) return null;

  return NextResponse.json(
    {
      error:
        "Diese Route gehört zum Homelab-Betrieb und wird auf einer flüchtigen " +
        "Instanz nicht bedient. In der Demo bleibt nichts liegen — es gibt " +
        "hier keinen Store, den sie lesen könnte.",
      profile,
      reason: "homelab-route-not-served-in-this-profile",
    },
    { status: 404 },
  );
}
