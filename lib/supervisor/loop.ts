import type {
  LoopPhase,
  LoopState,
  Supervisor,
  SupervisorContext,
  SupervisorDecision,
  SupervisorVerdict,
} from "./types";
import type { HermesDispatcher, HermesOrder } from "../hermes";
import type { SignedExecutionPlan } from "../../lib/schema/homelab";

/**
 * Planschleife (Etappe 10b).
 *
 * Der Supervisor durchläuft: assess → plan → authorize → observe →
 * verify → update → idle (oder weiter von vorne).
 *
 * Maximale Iterationen: 20. Danach wird eskaliert.
 * Kein Schritt autorisiert ohne Evidence. Kein Merge ohne CUE-Prüfung.
 */

const MAX_ITERATIONS = 20;

export function initialLoopState(): LoopState {
  return {
    phase: "assess",
    iteration: 0,
    lastVerdict: null,
    lastOrder: null,
    blockers: [],
    updatedAt: new Date().toISOString(),
  };
}

export function nextPhase(
  current: LoopPhase,
  verdict: SupervisorDecision,
): LoopPhase {
  if (verdict === "escalate" || verdict === "abandon") return "idle";
  if (verdict === "defer") return "assess";
  if (verdict === "shrink") return "plan";

  switch (current) {
    case "assess":    return "plan";
    case "plan":      return "authorize";
    case "authorize": return "observe";
    case "observe":   return "verify";
    case "verify":    return "update";
    case "update":    return "assess";
    case "idle":      return "idle";
  }
}

export function advanceLoop(
  state: LoopState,
  verdict: SupervisorVerdict,
  order: HermesOrder | null = null,
): LoopState {
  return {
    ...state,
    phase: nextPhase(state.phase, verdict.decision),
    iteration: state.iteration + 1,
    lastVerdict: verdict,
    lastOrder: order ?? state.lastOrder,
    blockers: verdict.blockers,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Basisimplementierung — entscheidet deterministisch anhand von
 * Context-Flags. Ein echter Supervisor würde hier Project-Graph,
 * Evidence-Store und Decision-Ledger konsultieren.
 */
export function assessContext(ctx: SupervisorContext): SupervisorVerdict {
  const now = new Date().toISOString();

  if (ctx.iteration >= MAX_ITERATIONS) {
    return {
      decision: "escalate",
      reason: `Maximale Iterationstiefe (${MAX_ITERATIONS}) erreicht — Mensch muss entscheiden.`,
      plan: null,
      blockers: ctx.blockers,
      decidedAt: now,
    };
  }

  if (ctx.blockers.length > 0) {
    return {
      decision: "defer",
      reason: `Aktive Blocker: ${ctx.blockers.join(", ")}`,
      plan: null,
      blockers: ctx.blockers,
      decidedAt: now,
    };
  }

  if (!ctx.evidenceSufficient) {
    return {
      decision: "defer",
      reason: "Nicht genug Evidence um eine sichere Entscheidung zu treffen.",
      plan: null,
      blockers: [],
      decidedAt: now,
    };
  }

  if (ctx.lastOrderSucceeded === false) {
    return {
      decision: "shrink",
      reason: "Letzter Auftrag fehlgeschlagen — Aufgabe verkleinern.",
      plan: null,
      blockers: [],
      decidedAt: now,
    };
  }

  return {
    decision: "authorize",
    reason: "Evidence ausreichend, keine Blocker — Auftrag autorisieren.",
    plan: null, // Caller füllt den Plan ein
    blockers: [],
    decidedAt: now,
  };
}

/**
 * Minimalimplementierung des Supervisor-Interfaces.
 * Delegiert alle Dispatches an den HermesDispatcher.
 * Erzwingt Ordering: authorize() darf nur nach assess() mit decision="authorize" aufgerufen werden.
 */
export class LoopSupervisor implements Supervisor {
  private state: LoopState = initialLoopState();

  constructor(private readonly hermes: HermesDispatcher) {}

  assess(context: SupervisorContext): SupervisorVerdict {
    const verdict = assessContext(context);
    this.state = advanceLoop(this.state, verdict);
    return verdict;
  }

  async authorize(plan: SignedExecutionPlan): Promise<HermesOrder> {
    if (this.state.lastVerdict?.decision !== "authorize") {
      throw new Error(
        `authorize() kann nur nach einem erfolgreichem assess() mit decision="authorize" aufgerufen werden. ` +
        `Aktuelle Entscheidung: ${this.state.lastVerdict?.decision ?? "keine"}`,
      );
    }

    const order = await this.hermes.submit(plan);

    this.state = {
      ...this.state,
      phase: "observe",
      lastOrder: order,
      updatedAt: new Date().toISOString(),
    };

    return order;
  }

  loopState(): LoopState {
    return this.state;
  }
}
