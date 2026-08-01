/**
 * Workshop-Ansicht (Etappe 11c).
 * Server-Komponente für die ALFRET-Kontrolltafel.
 */

import { WorkshopClient } from "./WorkshopClient";

export const metadata = {
  title: "ALFRET Workshop",
  description: "Inspect orders, sessions, CUE reports, and Maid findings in real-time.",
};

export default function WorkshopPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">ALFRET Workshop</h1>
          <p className="text-slate-600 mt-2">
            Evidence-First Repository Butler — Live Betrieb
          </p>
        </header>

        <WorkshopClient />
      </div>
    </div>
  );
}
