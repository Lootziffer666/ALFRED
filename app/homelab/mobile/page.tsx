/**
 * Raum IX · Mobile (Etappe 13d).
 *
 * Mobile-optimiert für Status, Node Health, und Eskalationen.
 * Server Component — liest Store direkt.
 */

import { MemoryAlfretStore } from "@/lib/store";
import { MobileWorkshopClient } from "./MobileWorkshopClient";

const store = new MemoryAlfretStore();

export const metadata = {
  title: "Mobile — ALFRET",
  description: "Node Health, Routing, Eskalationen — mobil optimiert",
};

export default async function MobilePage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Mobil-Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-white">ALFRET</h1>
          <span className="text-xs text-zinc-500">Mobile</span>
        </div>
      </header>

      <MobileWorkshopClient
        initialRunningOrders={[]}
        initialActiveSessions={[]}
      />
    </main>
  );
}
