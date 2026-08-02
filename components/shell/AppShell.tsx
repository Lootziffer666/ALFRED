"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
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

/**
 * Scroll position drives the whole palette across six keyframes (exact hex
 * stops from the reference screenshots), from near-black/deep-red at the
 * top toward warmer violet-tinted panels and a red-to-orange accent the
 * further down the page you go — and reverses the same way scrolling back
 * up, since it's a direct function of scroll position, not a one-shot
 * animation. --live-panel/--live-bg/--live-accent are aliased into the
 * Tailwind theme tokens in globals.css (--color-surface-container-low,
 * --color-background, --color-primary…), so every screen using those
 * utility classes updates automatically. --live-glow only feeds the
 * ambient background layer below.
 */
type RGB = readonly [number, number, number];

function lerpStops(stops: readonly RGB[], t: number): string {
  const n = stops.length - 1;
  const scaled = Math.min(Math.max(t, 0), 1) * n;
  const i = Math.min(Math.floor(scaled), n - 1);
  const localT = scaled - i;
  const [r0, g0, b0] = stops[i];
  const [r1, g1, b1] = stops[i + 1];
  const r = Math.round(r0 + (r1 - r0) * localT);
  const g = Math.round(g0 + (g1 - g0) * localT);
  const b = Math.round(b0 + (b1 - b0) * localT);
  return `rgb(${r}, ${g}, ${b})`;
}

// Six keyframes, top of page → deepest scroll. Exact stops from the
// reference screenshots — do not round or simplify these.
const PANEL_STOPS: readonly RGB[] = [
  [0, 0, 0],
  [14, 11, 13],
  [28, 22, 27],
  [36, 30, 37],
  [43, 35, 42],
  [46, 36, 46],
];
const BG_STOPS: readonly RGB[] = [
  [0, 0, 0],
  [14, 11, 13],
  [24, 21, 26],
  [39, 34, 43],
  [51, 43, 54],
  [57, 44, 61],
];
const ACCENT_STOPS: readonly RGB[] = [
  [140, 31, 31],
  [167, 46, 30],
  [194, 62, 30],
  [163, 82, 52],
  [211, 104, 75],
  [240, 127, 86],
];
const GLOW_STOPS: readonly RGB[] = [
  [176, 48, 32],
  [123, 71, 47],
  [246, 143, 94],
  [98, 60, 42],
  [156, 91, 68],
  [185, 116, 92],
];

function useMysticScroll() {
  useEffect(() => {
    const root = document.documentElement;
    let ticking = false;

    function apply() {
      ticking = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      root.style.setProperty("--live-panel", lerpStops(PANEL_STOPS, progress));
      root.style.setProperty("--live-bg", lerpStops(BG_STOPS, progress));
      root.style.setProperty("--live-accent", lerpStops(ACCENT_STOPS, progress));
      root.style.setProperty("--live-glow", lerpStops(GLOW_STOPS, progress));
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    }

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
}

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
  useMysticScroll();

  return (
    <div className="relative isolate lg:pl-72 min-h-screen flex flex-col text-on-surface">
      {/* ═══ Desktop sidebar ═══ */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-72 bg-surface-container-low border-r border-outline-variant/30 flex-col z-50">
        <div className="p-8 flex flex-col items-center border-b border-outline-variant/20 mb-4">
          <Image
            src="/brand/alfret-wordmark.png"
            alt="ALFRET"
            width={1536}
            height={716}
            priority
            className="w-40 h-auto mb-3"
            style={{ filter: "drop-shadow(0 0 12px color-mix(in srgb, var(--live-accent) 45%, transparent))" }}
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
            <div
              className="w-2 h-2 rounded-full bg-primary animate-pulse"
              style={{ boxShadow: "0 0 8px color-mix(in srgb, var(--live-accent) 60%, transparent)" }}
            />
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

      {/* Ambient glow — fixed to the viewport, not the (tall, scrolling) content,
          so the highlight stays visible no matter how far down the page the
          user has scrolled. The flat base color is --color-background itself
          (aliased to --live-bg, so <body>/<main> already carry it); this
          layer only adds the warm --live-glow halo on top of that. */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 15%, color-mix(in srgb, var(--live-glow) 26%, transparent) 0%, transparent 65%)",
          transition: "--live-glow 400ms ease-out",
        }}
      />

      {/* ═══ Main content ═══ */}
      <main className="relative z-10 flex-1 flex flex-col">
        <div className="max-w-3xl mx-auto w-full px-4 py-8 lg:px-10 lg:py-12">{children}</div>
      </main>
    </div>
  );
}
