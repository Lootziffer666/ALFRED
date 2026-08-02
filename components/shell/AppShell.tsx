"use client";

import Image from "next/image";
import Link from "next/link";
import { STEPS, useSession, type Step } from "../session/SessionContext";

/**
 * Chrome for the Repository-Butler workflow (Baustein 5). Visual language
 * from the Stitch mockup ("Nice.md") → Scriptorium design tokens in
 * globals.css. Scoped to `/` only — /archive, /workshop, /homelab and
 * /report keep their own established look, per the "plain mobile usability"
 * constraint already documented for the main tool in globals.css.
 */

const STEP_ICONS: Record<Step, string> = {
  setup: "settings_input_component",
  inventory: "inventory_2",
  contract: "analytics",
  handoff: "precision_manufacturing",
  audit: "fact_check",
};

const STEP_TITLES: Record<Step, string> = {
  setup: "Session Setup",
  inventory: "Repository Inventory",
  contract: "Model Analysis",
  handoff: "Refinery",
  audit: "Result Audit",
};

interface ModuleLink {
  href: string;
  label: string;
  sublabel: string;
  icon: string;
}

const MODULES: ModuleLink[] = [
  { href: "/report", label: "Öffentlicher Bericht", sublabel: "Prüfbericht · Biografie · Roast · CV", icon: "summarize" },
  { href: "/archive", label: "Raum VIII · Skriptorium", sublabel: "SQLite-Archiv, CUE-Berichte", icon: "library_books" },
  { href: "/homelab", label: "Raum IX · Werkstatt", sublabel: "Hardware-Planung", icon: "home_repair_service" },
  { href: "/workshop", label: "Workshop", sublabel: "Orders, Sessions, Findings", icon: "monitoring" },
];

function useReachability() {
  const { inventory, contractMap, handoff } = useSession();
  return (id: Step) => {
    if (id === "setup") return true;
    if (id === "inventory") return !!inventory;
    if (id === "contract") return !!inventory;
    if (id === "handoff") return !!contractMap;
    if (id === "audit") return !!handoff;
    return false;
  };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { step, setStep, demoMode, repoInput } = useSession();
  const isReachable = useReachability();

  return (
    <div className="lg:pl-72 min-h-screen flex flex-col bg-background text-on-surface">
      {/* ═══ Desktop sidebar ═══ */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-72 bg-surface-container-low border-r border-outline-variant/30 flex-col z-50">
        <div className="p-8 flex flex-col items-center border-b border-outline-variant/20 mb-4">
          <Image
            src="/brand/alfret-wordmark.png"
            alt="ALFRET"
            width={1536}
            height={716}
            priority
            className="w-40 h-auto mb-3 drop-shadow-[0_0_12px_rgba(163,22,22,0.35)]"
          />
          <span className="font-technical-data text-[10px] uppercase tracking-[0.2em] text-on-surface-variant/60">
            Repository-Butler
          </span>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto" aria-label="ALFRET workflow steps">
          {STEPS.map((s) => {
            const active = s.id === step;
            const reachable = isReachable(s.id);
            return (
              <button
                key={s.id}
                type="button"
                disabled={!reachable}
                onClick={() => reachable && setStep(s.id)}
                aria-current={active ? "step" : undefined}
                className={`group w-full flex items-center px-4 py-4 rounded-lg font-ui-label text-xs tracking-widest uppercase transition-all text-left ${
                  active
                    ? "bg-primary-container text-on-primary-container shadow-lg border-l-4 border-secondary"
                    : reachable
                      ? "text-on-surface-variant hover:bg-surface-container-high hover:text-white"
                      : "text-on-surface-variant/30 cursor-not-allowed"
                }`}
              >
                <span className={`material-symbols-outlined mr-4 text-sm ${active ? "" : "group-hover:text-primary"}`}>
                  {STEP_ICONS[s.id]}
                </span>
                <span>{STEP_TITLES[s.id]}</span>
              </button>
            );
          })}

          <div className="h-px bg-outline-variant/20 my-4 mx-4" />

          <div className="px-4 mb-2 font-technical-data text-[10px] uppercase tracking-[0.2em] text-on-surface-variant/40">
            Weitere Module
          </div>
          {MODULES.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group flex items-center px-4 py-3 text-on-surface-variant hover:bg-surface-container-high hover:text-white transition-all rounded-lg"
            >
              <span className="material-symbols-outlined mr-4 text-sm group-hover:text-primary">{m.icon}</span>
              <span className="flex flex-col">
                <span className="font-ui-label text-xs tracking-widest uppercase">{m.label}</span>
                <span className="font-technical-data text-[9px] text-on-surface-variant/50 normal-case tracking-normal">
                  {m.sublabel}
                </span>
              </span>
            </Link>
          ))}
        </nav>

        <div className="p-6 bg-surface-container border-t border-outline-variant/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-technical-data uppercase text-on-surface-variant/40 tracking-widest">
              System Core
            </span>
            <div className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(255,180,172,0.5)] animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="flex justify-between items-center text-[11px] font-technical-data uppercase">
              <span className="text-on-surface-variant/40">Repo:</span>
              <span className="text-secondary/80 truncate ml-2">{repoInput || "—"}</span>
            </div>
            <div className="flex justify-between items-center text-[11px] font-technical-data uppercase">
              <span className="text-on-surface-variant/40">Mode:</span>
              <span className="text-secondary/80">{demoMode ? "DEMO" : "LIVE"}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ═══ Mobile nav (below lg) ═══ */}
      <div className="lg:hidden sticky top-0 z-40 bg-surface-container-low/95 backdrop-blur-md border-b border-outline-variant/20">
        <div className="flex items-center gap-2 px-4 pt-3">
          <Image src="/brand/alfret-wordmark.png" alt="ALFRET" width={1536} height={716} priority className="h-6 w-auto" />
          <span className="font-technical-data text-[9px] uppercase tracking-[0.15em] text-on-surface-variant/50">
            Repository-Butler
          </span>
        </div>
        <nav aria-label="ALFRET workflow steps" className="overflow-x-auto px-4 py-3">
          <ol className="flex gap-2 min-w-max">
            {STEPS.map((s, i) => {
              const active = s.id === step;
              const reachable = isReachable(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => reachable && setStep(s.id)}
                    aria-current={active ? "step" : undefined}
                    className={`font-technical-data text-[11px] uppercase tracking-wide px-3 py-2 rounded-full border whitespace-nowrap min-h-[38px] transition-all ${
                      active
                        ? "border-primary bg-primary-container/30 text-on-surface"
                        : reachable
                          ? "border-outline-variant/30 bg-surface-container text-on-surface-variant/70"
                          : "border-outline-variant/10 bg-surface-container text-on-surface-variant/25"
                    }`}
                  >
                    <span className={active ? "text-primary" : "text-on-surface-variant/40"}>{i + 1}</span> {STEP_TITLES[s.id]}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        <div className="overflow-x-auto px-4 pb-3 -mt-1">
          <div className="flex gap-2 min-w-max">
            {MODULES.map((m) => (
              <Link
                key={m.href}
                href={m.href}
                className="font-technical-data text-[10px] uppercase tracking-wide px-3 py-1.5 rounded-full border border-outline-variant/20 text-on-surface-variant/60 whitespace-nowrap hover:border-primary/40 hover:text-primary transition-all"
              >
                {m.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ Main content ═══ */}
      <main className="flex-1 flex flex-col bg-[radial-gradient(circle_at_50%_0%,#1a1c1c_0%,#0d0e0f_100%)]">
        <div className="max-w-3xl mx-auto w-full px-4 py-8 lg:px-10 lg:py-12">{children}</div>
      </main>
    </div>
  );
}
