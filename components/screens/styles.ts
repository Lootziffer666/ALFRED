/** Shared Tailwind class strings for the Scriptorium-styled session screens. */

export const CARD_CLASS = "bg-surface-container-low border border-outline-variant/20 rounded-xl p-6 lg:p-8";

export const CARD_INSET_CLASS = "bg-surface-container border border-outline-variant/10 rounded-lg p-5";

export const INPUT_CLASS =
  "w-full bg-background border border-outline-variant/30 px-4 py-3 font-technical-data text-sm text-on-surface focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all rounded placeholder:text-on-surface-variant/30";

export const TEXTAREA_CLASS = `${INPUT_CLASS} resize-none`;

/* The Refinery/Handoff screen IS the document — a single continuous sheet
   of paper, not a dark panel dotted with individually boxed white inputs.
   PAPER_CLASS is the sheet itself; the PAPER_* tokens below are dark-ink
   variants of the label/heading/text styles for use on that white
   background, since the normal on-surface/on-surface-variant tokens are
   tuned for dark panels and would be unreadable here. Deliberately
   hardcoded #fff/#0a0a0a rather than theme tokens — this is the one
   surface in the app that isn't part of the dark Scriptorium shell. */
export const PAPER_CLASS = "bg-white text-[#0a0a0a] rounded-xl p-6 lg:p-10 shadow-[0_30px_80px_rgba(0,0,0,0.55)]";

export const PAPER_HEADING_CLASS = "font-document-heading text-2xl text-[#0a0a0a] mb-1";

export const PAPER_SUBTEXT_CLASS = "font-body-md text-black/50 text-sm italic mt-0 mb-6";

export const PAPER_LABEL_CLASS = "font-ui-label text-[11px] text-black/45 uppercase tracking-widest block mb-2";

/* Fields sit directly on the page: no box, no fill — just an ink-colored
   underline, the way a line on a printed form works. */
export const DOCUMENT_TEXTAREA_CLASS =
  "w-full bg-transparent text-[#0a0a0a] border-0 border-b border-black/15 px-0 py-2 font-technical-data text-sm focus:outline-none focus:border-primary transition-all resize-none placeholder:text-black/30";

export const PAPER_GHOST_BUTTON_CLASS =
  "flex items-center gap-3 px-6 py-3 border border-black/20 text-black/60 hover:bg-black/5 hover:text-[#0a0a0a] transition-all rounded font-ui-label text-xs uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed";

export const PRIMARY_BUTTON_CLASS =
  "flex items-center gap-3 px-6 py-3 bg-primary-container text-on-primary-container hover:brightness-110 transition-all rounded font-ui-label text-xs uppercase tracking-widest font-bold shadow-md shadow-primary-container/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100";

export const GHOST_BUTTON_CLASS =
  "flex items-center gap-3 px-6 py-3 border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all rounded font-ui-label text-xs uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed";

export const LABEL_CLASS = "font-ui-label text-[11px] text-outline uppercase tracking-widest block mb-2";

export const SECTION_KICKER_CLASS = "font-technical-data text-[10px] text-primary uppercase tracking-[0.3em] font-bold";

export const PILL_CLASS =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-technical-data text-[10px] uppercase tracking-wide border";
