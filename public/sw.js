/**
 * ALFRET Service Worker (Etappe 13c).
 *
 * Strategie: Network-First für alle API-Routen und dynamische Seiten.
 * Cache-First für statische Assets (JS, CSS, Fonts, Icons).
 *
 * Offline-Verhalten:
 * - Statische Assets → aus Cache
 * - API-Routen → Netzwerk, bei Fehler: Offline-Stub
 * - Dynamische Seiten → Netzwerk, bei Fehler: /offline
 *
 * Kein Push-Messaging. Kein Background-Sync in v1.
 * Keine dauerhaften Hintergrundprozesse (§23: keine dauerhafte Hintergrundlast).
 */

const CACHE_VERSION = "alfret-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const OFFLINE_URL = "/offline";

const STATIC_ASSETS = [
  "/",
  "/offline",
  "/workshop",
  "/homelab",
  "/report",
];

// ── Install ────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch(() => {
        // Nicht-kritisch — Assets werden bei Bedarf gecacht
      })
    )
  );

  self.skipWaiting();
});

// ── Activate ───────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );

  self.clients.claim();
});

// ── Fetch ──────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // SSE-Verbindungen niemals cachen oder intercepten
  if (url.pathname.startsWith("/api/workshop/events")) {
    return; // Browser-Default
  }

  // API-Routen: Network-First, bei Fehler Offline-JSON
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ ok: false, error: "Offline — kein Netzwerkzugriff." }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    return;
  }

  // Statische Assets: Cache-First
  if (
    url.pathname.match(/\.(js|css|woff2?|png|ico|svg)$/) ||
    url.pathname.startsWith("/_next/static/")
  ) {
    event.respondWith(
      caches.match(request).then((cached) =>
        cached ?? fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
          }

          return response;
        })
      )
    );

    return;
  }

  // Navigations: Network-First, Offline-Fallback
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((r) =>
          r ?? new Response("Offline", { status: 503 })
        )
      )
    );

    return;
  }
});
