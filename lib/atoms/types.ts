export interface Signals {
  readme: string;
  const: string;
  tree: string;
  commits: string;
  conv: string;
}

export type AtomCategory = "authority" | "causality" | "adjudication" | "epistemic";

export interface Evidence {
  k: string;
  v: string;
}

export type Trope = Record<1 | 2 | 3 | 4, string>;

export interface Rule {
  id: string;
  cat: AtomCategory;
  scan: (s: Signals) => Evidence[] | null;
  trope: Trope;
}

export interface Atom {
  id: string;
  cat: AtomCategory;
  evidence: Evidence[];
  trope: Trope;
  hyp: boolean;
  /** Present only for archive-wide (meta) atoms. */
  metaSentence?: string;
  count?: number;
  pct?: number;
}

export interface Level {
  name: string;
  open: string;
  turn: string;
  close: string;
  stil: string;
}

export interface Phase {
  key: string;
  title: string;
  lvlKey: "open" | "close" | null;
  pick: string[];
}
