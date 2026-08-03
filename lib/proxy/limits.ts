/**
 * Die reine Logik hinter proxy.ts: Rate-Limit-Fenster und Private-IP-Erkennung.
 *
 * Sie liegt hier, weil tests/middleware.test.ts sie vorher NACHGEBAUT hat —
 * eine zweite Kopie derselben Regeln, gegen die die Tests grün blieben,
 * während die ausgelieferte Fassung hätte kaputtgehen können. Jetzt prüfen die
 * Tests denselben Code, den der Proxy ausführt.
 *
 * Kein Import aus next/server hier: die Datei muss ohne Edge-Runtime laufen.
 */

/** Maximale Requests pro Fenster pro IP. */
export const RATE_LIMIT_MAX = 10;

/** Fenstergröße in Millisekunden. */
export const RATE_LIMIT_WINDOW_MS = 60_000; // 1 Minute

export interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Der Store wächst sonst unbegrenzt: jede je gesehene IP bliebe für immer darin
 * liegen. Beim Anlegen eines neuen Fensters werden abgelaufene Einträge mit
 * weggeräumt — das bindet die Map an die Zahl der aktiven Aufrufer.
 */
function pruneExpired(store: Map<string, RateLimitEntry>, now: number): void {
  for (const [key, entry] of store) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) store.delete(key);
  }
}

export function checkRateLimit(
  store: Map<string, RateLimitEntry>,
  key: string,
  now: number = Date.now(),
): RateLimitVerdict {
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    pruneExpired(store, now);
    store.set(key, { count: 1, windowStart: now });
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetAt: entry.windowStart + RATE_LIMIT_WINDOW_MS };
  }

  entry.count += 1;
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX - entry.count,
    resetAt: entry.windowStart + RATE_LIMIT_WINDOW_MS,
  };
}

/**
 * Prüft ob eine URL-Origin auf eine private oder lokale IP zeigt.
 * Verhindert dass die Public-Demo-Ausführung lokale Runner anspricht.
 */
export function isPrivateOrigin(url: string): boolean {
  try {
    const { hostname } = new URL(url);

    // URL.hostname klammert IPv6-Literale immer ein ("[fd00::1]"). Die
    // bisherigen IPv6-Prüfungen verglichen gegen die ungeklammerte Form und
    // trafen deshalb nie — jede IPv6-Adresse galt als öffentlich.
    const host = hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1)
      : hostname;

    return (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "0.0.0.0" ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^169\.254\./.test(host) ||          // IPv4 link-local (inkl. Cloud-Metadaten)
      /^f[cd][0-9a-f]{2}:/i.test(host) ||  // IPv6 ULA (fc00::/7)
      /^fe[89ab][0-9a-f]:/i.test(host)     // IPv6 link-local (fe80::/10)
    );
  } catch {
    return false;
  }
}
