"use client";

/**
 * Der einzige interaktive Teil der Offline-Seite. Als eigene Client-Komponente,
 * damit app/offline/page.tsx eine Server-Komponente bleiben kann (und damit
 * ihren metadata-Export behält) — ein onClick auf einer Server-Komponente
 * brach das Prerendering der Seite.
 */
export function RetryButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="mt-8 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
    >
      Erneut versuchen
    </button>
  );
}
