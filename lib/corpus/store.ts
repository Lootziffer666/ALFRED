import type { EvidenceKind, EvidenceRecord } from "../schema/corpus";
import type { DetailedEvidenceRef } from "../schema/common";

/**
 * The evidence store (plan §10.4). Findings point here; nothing in the corpus
 * carries its own private copy of a source.
 */
export class EvidenceStore {
  private readonly byId = new Map<string, EvidenceRecord>();

  constructor(records: EvidenceRecord[] = []) {
    for (const record of records) this.byId.set(record.id, record);
  }

  add(record: EvidenceRecord): EvidenceRecord {
    this.byId.set(record.id, record);
    return record;
  }

  /** Records a source and returns its id, so a finding can point at it. */
  record(input: { id: string; kind: EvidenceKind; ref: DetailedEvidenceRef; recordedAt: string }): string {
    this.add(input);
    return input.id;
  }

  get(id: string): EvidenceRecord | undefined {
    return this.byId.get(id);
  }

  /** Resolves ids, skipping ones the store does not know rather than inventing them. */
  resolve(ids: string[]): EvidenceRecord[] {
    return ids.map((id) => this.byId.get(id)).filter((r): r is EvidenceRecord => r !== undefined);
  }

  /** Ids that were pointed at but never recorded — a dangling claim. */
  missing(ids: string[]): string[] {
    return ids.filter((id) => !this.byId.has(id));
  }

  forRepository(repository: string): EvidenceRecord[] {
    return this.all().filter((r) => r.ref.repository === repository);
  }

  all(): EvidenceRecord[] {
    return [...this.byId.values()];
  }

  get size(): number {
    return this.byId.size;
  }
}
