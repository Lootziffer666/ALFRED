import { z } from "zod";
import {
  CORPUS_SNAPSHOT_VERSION,
  corpusSnapshotSchema,
  type CorpusSnapshot,
  type DonorEntry,
  type ExternalEntry,
  type ProjectEntry,
} from "../schema/corpus";
import { EvidenceStore } from "./store";
import { ProjectGraph } from "./graph";
import { DecisionLedger } from "./ledger";

/**
 * Persistence (plan §10.7): browser state plus a versioned JSON export and
 * import. No database requirement, and no silent migration — a snapshot from a
 * version this build does not know is refused with a readable message rather
 * than being half-read.
 */

export interface Corpus {
  project: ProjectEntry[];
  donor: DonorEntry[];
  external: ExternalEntry[];
  evidence: EvidenceStore;
  graph: ProjectGraph;
  ledger: DecisionLedger;
}

export function createCorpus(): Corpus {
  return {
    project: [],
    donor: [],
    external: [],
    evidence: new EvidenceStore(),
    graph: new ProjectGraph(),
    ledger: new DecisionLedger(),
  };
}

export class SnapshotVersionError extends Error {
  constructor(found: unknown) {
    super(
      `Corpus snapshot version ${String(found)} cannot be read by this build ` +
        `(expected ${CORPUS_SNAPSHOT_VERSION}). Export it again from the version that wrote it.`,
    );
    this.name = "SnapshotVersionError";
  }
}

export function toSnapshot(corpus: Corpus, exportedAt = new Date().toISOString()): CorpusSnapshot {
  const { nodes, edges } = corpus.graph.toJSON();
  return {
    version: CORPUS_SNAPSHOT_VERSION,
    exportedAt,
    project: corpus.project,
    donor: corpus.donor,
    external: corpus.external,
    evidence: corpus.evidence.all(),
    nodes,
    edges,
    decisions: corpus.ledger.toJSON(),
  };
}

export function exportCorpus(corpus: Corpus, exportedAt?: string): string {
  return JSON.stringify(toSnapshot(corpus, exportedAt), null, 2);
}

export function fromSnapshot(snapshot: CorpusSnapshot): Corpus {
  return {
    project: snapshot.project,
    donor: snapshot.donor,
    external: snapshot.external,
    evidence: new EvidenceStore(snapshot.evidence),
    graph: new ProjectGraph(snapshot.nodes, snapshot.edges),
    ledger: new DecisionLedger(snapshot.decisions),
  };
}

/** Parses untrusted JSON. Version first, so a mismatch reads clearly. */
export function importCorpus(raw: string | unknown): Corpus {
  let input: unknown;
  if (typeof raw === "string") {
    try {
      input = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Corpus snapshot is not valid JSON: ${(err as Error).message}`);
    }
  } else {
    input = raw;
  }

  const version = (input as { version?: unknown })?.version;
  if (version !== CORPUS_SNAPSHOT_VERSION) throw new SnapshotVersionError(version);

  const parsed = corpusSnapshotSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Corpus snapshot is malformed:\n${z.prettifyError(parsed.error)}`);

  return fromSnapshot(parsed.data);
}

/** Ids pointed at by nodes or decisions that the evidence store never recorded. */
export function danglingEvidenceIds(corpus: Corpus): string[] {
  const referenced = [
    ...corpus.graph.toJSON().nodes.flatMap((n) => n.evidenceIds),
    ...corpus.ledger.all().flatMap((d) => d.evidenceIds),
    ...corpus.project.flatMap((e) => e.capabilities.flatMap((c) => c.evidenceIds)),
  ];
  return [...new Set(corpus.evidence.missing(referenced))];
}
