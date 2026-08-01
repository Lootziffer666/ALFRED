/**
 * ALFRET-CTA-Komponente (Etappe 12c).
 *
 * Rendert den CTA am Ende des Reports (Eisberg-CTA aus §8.9).
 * Variante wird serverseitig über resolveCtaVariant() bestimmt —
 * nicht clientseitig, um kein Layout-Shift zu riskieren.
 */

import { resolveCtaVariant, getCtaContent } from "@/lib/flags";

export function AlfretCta() {
  const variant = resolveCtaVariant();
  const cta = getCtaContent(variant);

  return (
    <aside
      className="mt-12 rounded-2xl border border-indigo-500/30 bg-indigo-950/40 px-8 py-8"
      aria-label="ALFRET-CTA"
    >
      {/* Eisberg-Illustration — rein dekorativ */}
      <div className="mb-5 flex justify-center" aria-hidden>
        <IcebergIcon />
      </div>

      <h2 className="text-center text-xl font-semibold text-white">
        {cta.headline}
      </h2>
      <p className="mt-2 text-center text-sm text-zinc-400 max-w-md mx-auto">
        {cta.body}
      </p>

      <div className="mt-6 flex justify-center">
        <a
          href={cta.buttonHref}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition-colors"
        >
          {cta.buttonText}
          <ArrowRightIcon />
        </a>
      </div>

      {/* Eisberg-Beschriftung */}
      <ul className="mt-8 grid grid-cols-2 gap-2 text-xs text-zinc-500 sm:grid-cols-3">
        {ICEBERG_ITEMS.map((item) => (
          <li key={item} className="flex items-start gap-1.5">
            <span className="mt-0.5 shrink-0 text-indigo-400">▸</span>
            {item}
          </li>
        ))}
      </ul>
    </aside>
  );
}

const ICEBERG_ITEMS = [
  "Projektkorpus",
  "Evidence Store",
  "Project Graph",
  "Decision Ledger",
  "Supervisor-Loop",
  "Hermes-Orchestrierung",
  "Repo Maid",
  "Refinery",
  "Donor-Suche",
  "Modellwahl",
  "Ressourcenplanung",
  "Runner & Nodes",
];

function IcebergIcon() {
  return (
    <svg viewBox="0 0 80 60" className="h-16 w-20 opacity-60" fill="none" aria-hidden>
      {/* Sichtbarer Teil */}
      <polygon points="40,4 62,28 18,28" fill="#6366f1" opacity="0.9" />

      {/* Wasserlinie */}
      <line x1="8" y1="30" x2="72" y2="30" stroke="#4f46e5" strokeWidth="1" strokeDasharray="4 2" />

      {/* Unterwasser-Teil */}
      <polygon points="40,56 72,32 8,32" fill="#4338ca" opacity="0.5" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
