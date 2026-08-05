/**
 * Offline-Fallback-Seite (Etappe 13c).
 *
 * Wird vom Service Worker ausgeliefert wenn keine Netzwerkverbindung
 * besteht und die angefragte Seite nicht gecacht ist.
 */

import { RetryButton } from "./RetryButton";

export const metadata = {
  title: "Offline — ALFRET",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 text-zinc-100 px-6">
      <div className="max-w-md text-center">
        <div className="mb-6 flex justify-center" aria-hidden>
          <svg viewBox="0 0 64 64" className="h-16 w-16 text-zinc-600" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="32" cy="32" r="28" />
            <path d="M20 32h24M32 20v24" strokeLinecap="round" />
            <path d="M44 20L20 44" strokeLinecap="round" strokeDasharray="4 3" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white">Kein Netzwerkzugriff</h1>

        <p className="mt-3 text-sm text-zinc-400">
          ALFRET ist gerade offline. Die Werkstatt und gecachte Seiten
          sind weiterhin verfügbar — API-Calls und Live-Updates
          funktionieren erst wieder mit Verbindung.
        </p>

        <RetryButton />
      </div>
    </main>
  );
}
