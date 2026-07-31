import type { Signals } from "../atoms/types";
import type { Availability, AvailabilityStatus, DocEvidence, RepoEvidence } from "../schema";

/**
 * Maps fetched repository evidence onto the five signal slots the atom rules
 * scan (`lib/atoms/types.ts`). Every slot reports where it came from and, when
 * it stayed empty, why — a slot with no source is stated as such rather than
 * silently reducing what the rules can find.
 */

export type SignalSlot = keyof Signals;

const README_DOC = /^readme(\.|$)/i;
const CONSTITUTION_DOC = /^(claude|architecture|rules?|plan|agents)(\.|$)/i;
const CONVENTION_DOC = /^(conventions?|contributing)(\.|$)/i;

export interface SignalSource {
  slot: SignalSlot;
  label: string;
  status: AvailabilityStatus;
  reason?: string;
  /** Repository paths (or API endpoints) this slot was filled from. */
  paths: string[];
  chars: number;
}

export interface SignalMapping {
  signals: Signals;
  sources: SignalSource[];
}

const SLOT_LABELS: Record<SignalSlot, string> = {
  readme: "README",
  const: "Verfassungs-Dokumente",
  tree: "Dateibaum",
  commits: "Commits und Pull Requests",
  conv: "Konventionen",
};

function basename(p: string): string {
  return p.split("/").pop() ?? p;
}

function docsMatching(docs: DocEvidence[], pattern: RegExp): DocEvidence[] {
  return docs.filter((d) => !d.path.includes("/") && pattern.test(basename(d.path)));
}

function reasonOf(a: Availability<unknown>): string | undefined {
  return a.status === "loaded" || a.status === "loading" ? undefined : (a as { reason: string }).reason;
}

/** Builds one slot, propagating the upstream availability when the fetch itself failed. */
function slotFrom(
  slot: SignalSlot,
  upstream: Availability<unknown>,
  parts: { path: string; text: string }[],
  emptyReason: string,
): { text: string; source: SignalSource } {
  const label = SLOT_LABELS[slot];

  if (upstream.status !== "loaded") {
    return {
      text: "",
      source: { slot, label, status: upstream.status, reason: reasonOf(upstream), paths: [], chars: 0 },
    };
  }

  const used = parts.filter((p) => p.text.trim().length > 0);
  if (used.length === 0) {
    return { text: "", source: { slot, label, status: "skipped", reason: emptyReason, paths: [], chars: 0 } };
  }

  const text = used.map((p) => p.text).join("\n");
  return {
    text,
    source: { slot, label, status: "loaded", paths: used.map((p) => p.path), chars: text.length },
  };
}

export function signalsFromEvidence(evidence: RepoEvidence): SignalMapping {
  const docs = evidence.docs.status === "loaded" ? evidence.docs.data : [];

  const readme = slotFrom(
    "readme",
    evidence.docs,
    docsMatching(docs, README_DOC).map((d) => ({ path: d.path, text: d.excerpt })),
    "Kein README im Wurzelverzeichnis gefunden.",
  );

  const constitution = slotFrom(
    "const",
    evidence.docs,
    docsMatching(docs, CONSTITUTION_DOC).map((d) => ({ path: d.path, text: d.excerpt })),
    "Keine Verfassungs-Datei (CLAUDE/ARCHITECTURE/RULES/PLAN/AGENTS) im Wurzelverzeichnis.",
  );

  const conventions = slotFrom(
    "conv",
    evidence.docs,
    [
      ...docsMatching(docs, CONVENTION_DOC),
      ...docs.filter((d) => /^docs\//i.test(d.path)),
    ].map((d) => ({ path: d.path, text: d.excerpt })),
    "Keine CONTRIBUTING/CONVENTIONS-Datei und keine Dokumente unter docs/.",
  );

  const tree = slotFrom(
    "tree",
    evidence.tree,
    evidence.tree.status === "loaded"
      ? [{ path: "git/trees", text: evidence.tree.data.map((e) => e.path).join("\n") }]
      : [],
    "Der Dateibaum war leer.",
  );

  const prTitles =
    evidence.pullRequests.status === "loaded"
      ? evidence.pullRequests.data.recent.map((p) => `PR #${p.number} ${p.title}`)
      : [];
  const commits = slotFrom(
    "commits",
    evidence.commits,
    [
      {
        path: "commits",
        text: evidence.commits.status === "loaded" ? evidence.commits.data.map((c) => c.message).join("\n") : "",
      },
      { path: "pulls", text: prTitles.join("\n") },
    ],
    "Keine Commit-Nachrichten verfügbar.",
  );

  return {
    signals: {
      readme: readme.text,
      const: constitution.text,
      tree: tree.text,
      commits: commits.text,
      conv: conventions.text,
    },
    sources: [readme.source, constitution.source, tree.source, commits.source, conventions.source],
  };
}
