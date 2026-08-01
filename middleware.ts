/**
 * Edge-Middleware (Etappe 12a).
 *
 * Zuständigkeiten:
 * 1. Rate-Limiting für /api/demo/run und /api/report/enhance
 *    (die einzigen Routen die potenziell teuer oder missbrauchbar sind)
 * 2. Ablehnung von Requests mit privaten IP-Adressen an Demo-Routen
 *    (Public Demo darf keine lokalen Runner ansprechen — §7.1)
 * 3. Operating-Profile-Header setzen damit Route-Handler wissen
 *    in welchem Profil sie laufen
 *
 * Bewusst NICHT hier:
 * - Authentifizierung (keine in der Public Demo)
 * - Secrets (Middleware läuft im Edge, keine Env-Zugriffe für Secrets)
 * - Geschäftslogik
 *
 * Rate-Limit-Implementierung: gleitendes Fenster per IP, in-memory
 * im Edge-Runtime (Vercel / Cloudflare Workers kompatibel).
 * In-memory = kein persistentes Limit über mehrere Instanzen hinweg —
 * das ist für die Demo-Nutzung ausreichend und wird so dokumentiert.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ── Konfiguration ────────────────────────────────────────────────────────────

/** Routen die einem Rate-Limit unterliegen. */
const RATE_LIMITED_ROUTES = [
  "/api/demo/run",
  "/api/report/enhance",   // optionale Modellveredelung (Etappe 1C)
] as const;

/** Maximale Requests pro Fenster pro IP. */
const RATE_LIMIT_MAX = 10;

/** Fenstergröße in Millisekunden. */
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 Minute

/** Demo-Routen die niemals private IPs ansprechen dürfen. */
const DEMO_ONLY_ROUTES = ["/api/demo/"] as const;

// ── In-Memory Rate-Limit Store ───────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

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

function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    // Neues Fenster
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    const resetAt = entry.windowStart + RATE_LIMIT_WINDOW_MS;
    return { allowed: false, remaining: 0, resetAt };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX - entry.count,
    resetAt: entry.windowStart + RATE_LIMIT_WINDOW_MS,
  };
}

// ── Private-IP-Erkennung ─────────────────────────────────────────────────────

/**
 * Prüft ob eine URL-Origin auf eine private oder lokale IP zeigt.
 * Verhindert dass die Public-Demo-Ausführung lokale Runner anspricht.
 *
 * Betrifft nur Demo-Routen — nicht die gesamte App.
 */
function isPrivateOrigin(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^fd[0-9a-f]{2}:/i.test(hostname) // IPv6 ULA
    );
  } catch {
    return false;
  }
}

// ── Operating Profile ────────────────────────────────────────────────────────

/**
 * Bestimmt das Operating Profile anhand der Umgebung.
 *
 * - ALFRET_PROFILE=local-installation → local-installation
 * - ALFRET_PROFILE=public-demo oder nicht gesetzt → public-demo
 *
 * Route-Handler lesen diesen Header um zu wissen ob sie
 * lokale Runner ansprechen dürfen.
 */
function resolveOperatingProfile(): "public-demo" | "local-installation" {
  // Edge-Runtime: process.env ist verfügbar in Next.js Edge
  const envProfile = process.env.ALFRET_PROFILE;
  if (envProfile === "local-installation") return "local-installation";
  return "public-demo";
}

// ── Middleware ────────────────────────────────────────────────────────────────

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const profile = resolveOperatingProfile();

  // ── Demo-Routen: Private-IP-Check ────────────────────────────────────────
  // Verhindert dass /api/demo/* intern auf lokale Dienste weitergeleitet wird.
  // Betrifft den Referer und den Origin-Header.
  if (profile === "public-demo" && DEMO_ONLY_ROUTES.some((p) => pathname.startsWith(p))) {
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
    const { allowed, remaining, resetAt } = checkRateLimit(key);

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
