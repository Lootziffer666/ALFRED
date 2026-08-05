/**
 * Edge-Proxy (Etappe 12a) — bis Next.js 16 „middleware.ts" genannt.
 *
 * Zuständigkeiten:
 * 1. Rate-Limiting für /api/demo/run und /api/report/enhance
 *    (die einzigen Routen die potenziell teuer oder missbrauchbar sind)
 * 2. Ablehnung von Requests mit privaten IP-Adressen an Demo-Routen
 *    (Public Demo darf keine lokalen Runner ansprechen — §7.1)
 * 3. Operating-Profile-Header setzen, damit der Client sieht, in welchem
 *    Profil die Instanz läuft
 *
 * Bewusst NICHT hier:
 * - Authentifizierung (keine in der Public Demo)
 * - Secrets (der Proxy läuft im Edge, keine Env-Zugriffe für Secrets)
 * - Geschäftslogik
 * - Policy-Entscheidungen für Route-Handler. Der gesetzte Header ist Anzeige,
 *   keine Autorität: Handler lesen das Profil selbst aus der Serverumgebung
 *   (lib/profile/operating.ts).
 *
 * Rate-Limit-Implementierung: gleitendes Fenster per IP, in-memory
 * im Edge-Runtime (Vercel / Cloudflare Workers kompatibel).
 * In-memory = kein persistentes Limit über mehrere Instanzen hinweg —
 * das ist für die Demo-Nutzung ausreichend und wird so dokumentiert.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { OperatingProfile } from "@/lib/schema/homelab";
import {
  checkRateLimit,
  isPrivateOrigin,
  RATE_LIMIT_MAX,
  type RateLimitEntry,
} from "@/lib/proxy/limits";

// ── Konfiguration ────────────────────────────────────────────────────────────

/** Routen die einem Rate-Limit unterliegen. */
const RATE_LIMITED_ROUTES = [
  "/api/demo/run",
  "/api/report/enhance",   // optionale Modellveredelung (Etappe 1C)
] as const;

/** Demo-Routen die niemals private IPs ansprechen dürfen. */
const DEMO_ONLY_ROUTES = ["/api/demo/"] as const;

// ── In-Memory Rate-Limit Store ───────────────────────────────────────────────

// Edge-Runtime: globaler State lebt nur in dieser Instanz.
// Über mehrere Instanzen hinweg kein geteiltes Limit — bewusste Entscheidung.
const rateLimitStore = new Map<string, RateLimitEntry>();

function getRateLimitKey(req: NextRequest, route: string): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  return `${ip}::${route}`;
}

// ── Operating Profile ────────────────────────────────────────────────────────

/**
 * Bestimmt das Operating Profile anhand der Umgebung.
 *
 * Das Vokabular ist dasselbe wie in lib/schema/homelab.ts
 * ("homelab" | "ci" | "local-dev" | "production"). Vorher setzte diese Datei
 * "public-demo"/"local-installation" — Werte, die kein Route-Handler kannte,
 * weshalb jeder Handler still auf "production" zurückfiel.
 *
 * Der Proxy kann process.env nicht mit lib/profile/operating.ts teilen: die
 * Edge-Runtime lädt keine Node-Module. Beide Stellen lesen dieselbe Variable.
 */
function resolveOperatingProfile(): OperatingProfile {
  // Edge-Runtime: process.env ist verfügbar in Next.js Edge
  const envProfile = process.env.ALFRET_PROFILE;
  if (
    envProfile === "homelab" ||
    envProfile === "ci" ||
    envProfile === "local-dev" ||
    envProfile === "production"
  ) {
    return envProfile;
  }
  return "production";
}

/** Profile, in denen die Demo-Beschränkungen nicht gelten. */
function isLocalProfile(profile: OperatingProfile): boolean {
  return profile === "local-dev" || profile === "homelab";
}

// ── Proxy ─────────────────────────────────────────────────────────────────────

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const profile = resolveOperatingProfile();

  // ── Demo-Routen: Private-IP-Check ────────────────────────────────────────
  // Verhindert dass /api/demo/* intern auf lokale Dienste weitergeleitet wird.
  if (!isLocalProfile(profile) && DEMO_ONLY_ROUTES.some((p) => pathname.startsWith(p))) {
    const origin = req.headers.get("origin") ?? "";
    if (origin && isPrivateOrigin(origin)) {
      return NextResponse.json(
        { ok: false, error: "Demo-Routen akzeptieren keine privaten Ursprünge." },
        { status: 403 },
      );
    }
  }

  // ── Rate-Limiting ─────────────────────────────────────────────────────────
  const isRateLimited = RATE_LIMITED_ROUTES.some((r) => pathname.startsWith(r));
  if (isRateLimited) {
    const key = getRateLimitKey(req, pathname);
    const { allowed, remaining, resetAt } = checkRateLimit(rateLimitStore, key);

    if (!allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: "Zu viele Anfragen. Bitte in einer Minute erneut versuchen.",
          retryAfter: Math.ceil((resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
            "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
          },
        },
      );
    }

    // Erlaubt — Header setzen und weiterleiten
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-alfret-profile", profile);
    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set("X-RateLimit-Limit", String(RATE_LIMIT_MAX));
    response.headers.set("X-RateLimit-Remaining", String(remaining));
    response.headers.set("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
    return response;
  }

  // ── Alle anderen Routen: nur Profile-Header setzen ────────────────────────
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-alfret-profile", profile);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/api/:path*",
    "/report/:path*",
    "/workshop/:path*",
    "/homelab/:path*",
  ],
};
