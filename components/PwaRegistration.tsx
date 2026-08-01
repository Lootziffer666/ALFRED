/**
 * PWA-Registrierung (Etappe 13c).
 *
 * Registriert den Service Worker beim App-Start.
 * Zeigt Debug-Infos in der Console.
 *
 * Verwendung: In Root-Layout importieren und rendern (Client Component).
 */

"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      console.info("[PWA] ServiceWorker nicht unterstützt");
      return;
    }

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        console.info("[PWA] ServiceWorker registriert", {
          scope: registration.scope,
          active: registration.active?.scriptURL,
          installing: registration.installing?.scriptURL,
          waiting: registration.waiting?.scriptURL,
        });

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              console.info("[PWA] Update verfügbar — Seite neu laden zum Installieren");
            }
          });
        });
      } catch (err) {
        console.error("[PWA] ServiceWorker-Registrierung fehlgeschlagen", err);
      }
    };

    // Verzögere Registrierung um Seiten-Load nicht zu blockieren
    if (document.readyState === "complete") {
      registerServiceWorker();
    } else {
      window.addEventListener("load", registerServiceWorker);
      return () => window.removeEventListener("load", registerServiceWorker);
    }
  }, []);

  return null;
}
