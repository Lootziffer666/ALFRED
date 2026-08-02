/** Shared Tailwind class strings for the Scriptorium-styled session screens. */

/* Tinted by the scroll-driven --mystic-b custom property (see AppShell.tsx)
   instead of a flat surface color, so panels visibly participate in the
   ambient color shift instead of staying static while only the margins
   around them change. */
export const CARD_CLASS =
  "bg-[color-mix(in_srgb,var(--mystic-b)_12%,#1a1a1a_88%)] border border-outline-variant/20 rounded-xl p-6 lg:p-8";

export const CARD_INSET_CLASS =
  "bg-[color-mix(in_srgb,var(--mystic-b)_18%,#202020_82%)] border border-outline-variant/10 rounded-lg p-5";

export const INPUT_CLASS =
  "w-full bg-background border border-outline-variant/30 px-4 py-3 font-technical-data text-sm text-on-surface focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all rounded placeholder:text-on-surface-variant/30";

export const TEXTAREA_CLASS = `${INPUT_CLASS} resize-none`;

export const PRIMARY_BUTTON_CLASS =
  "flex items-center gap-3 px-6 py-3 bg-primary-container text-on-primary-container hover:brightness-110 transition-all rounded font-ui-label text-xs uppercase tracking-widest font-bold shadow-md shadow-primary-container/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100";

export const GHOST_BUTTON_CLASS =
  "flex items-center gap-3 px-6 py-3 border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all rounded font-ui-label text-xs uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed";

export const LABEL_CLASS = "font-ui-label text-[11px] text-outline uppercase tracking-widest block mb-2";

export const SECTION_KICKER_CLASS = "font-technical-data text-[10px] text-primary uppercase tracking-[0.3em] font-bold";

export const PILL_CLASS =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-technical-data text-[10px] uppercase tracking-wide border";
