/** Shared Tailwind class strings for the Scriptorium-styled session screens. */

/* bg-surface-container-low/-container resolve to --live-panel (see
   globals.css @theme block), which AppShell.tsx drives across the scroll
   keyframes — panels shift color automatically, no per-component wiring. */
export const CARD_CLASS = "bg-surface-container-low border border-outline-variant/20 rounded-xl p-6 lg:p-8";

export const CARD_INSET_CLASS = "bg-surface-container border border-outline-variant/10 rounded-lg p-5";

export const INPUT_CLASS =
  "w-full bg-background border border-outline-variant/30 px-4 py-3 font-technical-data text-sm text-on-surface focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all rounded placeholder:text-on-surface-variant/30";

export const TEXTAREA_CLASS = `${INPUT_CLASS} resize-none`;

/* The Refinery/Handoff screen is the "document" page — its text fields are
   the literal sheet of paper from the reference mockup and stay pure white
   with dark ink, unlike every other input on the fixed six-keyframe scroll
   palette (see AppShell.tsx). Deliberately hardcoded #fff/#0a0a0a rather
   than theme tokens, since this is the one surface that must NOT move. */
export const DOCUMENT_TEXTAREA_CLASS =
  "w-full bg-white text-[#0a0a0a] border border-black/15 px-4 py-3 font-technical-data text-sm focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all rounded resize-none placeholder:text-black/30";

export const PRIMARY_BUTTON_CLASS =
  "flex items-center gap-3 px-6 py-3 bg-primary-container text-on-primary-container hover:brightness-110 transition-all rounded font-ui-label text-xs uppercase tracking-widest font-bold shadow-md shadow-primary-container/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100";

export const GHOST_BUTTON_CLASS =
  "flex items-center gap-3 px-6 py-3 border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all rounded font-ui-label text-xs uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed";

export const LABEL_CLASS = "font-ui-label text-[11px] text-outline uppercase tracking-widest block mb-2";

export const SECTION_KICKER_CLASS = "font-technical-data text-[10px] text-primary uppercase tracking-[0.3em] font-bold";

export const PILL_CLASS =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-technical-data text-[10px] uppercase tracking-wide border";
