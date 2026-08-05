/**
 * Workshop-Ansicht (Etappe 11c).
 * Server-Komponente für die ALFRET-Kontrolltafel.
 */

import Link from "next/link";
import { WorkshopClient } from "./WorkshopClient";

export const metadata = {
  title: "ALFRET Workshop",
  description: "Inspect orders, sessions, CUE reports, and Maid findings in real-time.",
};

const NAV_LINK_CLASS =
  "inline-flex items-center px-3 py-1 rounded-full border border-slate-300 text-slate-600 text-xs font-medium hover:border-slate-400 hover:text-slate-900 transition-colors no-underline";

export default function WorkshopPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <nav className="flex flex-wrap gap-2 mb-4" aria-label="ALFRET rooms">
            <Link href="/" className={NAV_LINK_CLASS}>Repository-Butler</Link>
            <Link href="/archive" className={NAV_LINK_CLASS}>Raum VIII · Skriptorium</Link>
            <Link href="/homelab" className={NAV_LINK_CLASS}>Raum IX · Werkstatt</Link>
            <Link href="/report" className={NAV_LINK_CLASS}>Öffentlicher Bericht</Link>
          </nav>
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
