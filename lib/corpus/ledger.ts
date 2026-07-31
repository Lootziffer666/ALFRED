import type { Decision } from "../schema/corpus";

/**
 * The decision ledger (plan §10.6).
 *
 * A superseded decision stays readable as history but stops being binding.
 * Recording a newer decision for the same scope retires the older one — the
 * plan's rule that historical milestones must not block a current architecture
 * decision, enforced in code rather than remembered.
 */
export class DecisionLedger {
  private readonly byId = new Map<string, Decision>();

  constructor(decisions: Decision[] = []) {
    for (const decision of decisions) this.byId.set(decision.id, decision);
  }

  /**
   * Records a decision and retires everything it explicitly replaces. A
   * decision listed in `supersedes` that is not in the ledger is an error, not
   * a silent no-op: a decision cannot claim to replace something unknown.
   */
  record(decision: Decision): Decision {
    for (const olderId of decision.supersedes) {
      const older = this.byId.get(olderId);
      if (!older) throw new Error(`Cannot supersede unknown decision: ${olderId}`);
      this.byId.set(olderId, { ...older, status: "superseded" });
    }
    this.byId.set(decision.id, decision);
    return decision;
  }

  get(id: string): Decision | undefined {
    return this.byId.get(id);
  }

  all(): Decision[] {
    return [...this.byId.values()];
  }

  active(scope?: string): Decision[] {
    return this.all().filter((d) => d.status === "active" && (!scope || d.scope === scope));
  }

  history(scope: string): Decision[] {
    return this.all()
      .filter((d) => d.scope === scope)
      .sort((a, b) => a.decidedAt.localeCompare(b.decidedAt));
  }

  /**
   * What currently applies to a scope. Returns the newest active decision, or
   * null when the scope was never decided — never a superseded one.
   */
  resolve(scope: string): Decision | null {
    const active = this.active(scope).sort((a, b) => b.decidedAt.localeCompare(a.decidedAt));
    return active[0] ?? null;
  }

  toJSON(): Decision[] {
    return this.all();
  }
}
