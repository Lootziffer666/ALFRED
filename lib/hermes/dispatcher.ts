import type {
  HandoffPackage,
  HermesDispatcher,
  HermesEvent,
  HermesOrder,
  HermesSession,
} from "./types";
import type { SignedExecutionPlan } from "../../lib/schema/homelab";
import { createOrder, isDuplicate, transitionOrder } from "./orders";
import { createSession, detectWorktreeConflict } from "./sessions";
import { createHandoff } from "./handoffs";
import { makeEvent, OrderEventLog } from "./events";

/**
 * In-Memory HermesDispatcher (Etappe 10a).
 *
 * Diese Implementierung ist vollständig in-process. Sie hat keinen
 * persistenten State — bei einem Neustart sind alle Aufträge weg.
 * Das ist für Etappe 10 korrekt; Persistenz kommt mit Etappe 11.
 *
 * Der Dispatcher prüft bei jedem submit():
 * 1. Ist der Plan gültig signiert? (Delegiert an signing.ts)
 * 2. Gibt es bereits einen aktiven Auftrag für diesen Plan?
 * 3. Gibt es einen Worktree-Konflikt?
 *
 * Er entscheidet nicht über Produktstrategie. Er fragt nie:
 * "Soll ich das tun?" — das hat der Supervisor bereits entschieden.
 */
export class InMemoryHermesDispatcher implements HermesDispatcher {
  private orders = new Map<string, HermesOrder>();
  private sessions = new Map<string, HermesSession>();
  private handoffs = new Map<string, HandoffPackage>();
  private eventLog = new OrderEventLog();

  async submit(plan: SignedExecutionPlan): Promise<HermesOrder> {
    const all = [...this.orders.values()];

    if (isDuplicate(all, plan.planId)) {
      throw new Error(`Auftrag für Plan ${plan.planId} läuft bereits.`);
    }

    const order = createOrder(plan, 1);
    this.orders.set(order.orderId, order);

    this.eventLog.append(
      makeEvent("order-created", order.orderId, { planId: plan.planId }),
    );

    return order;
  }

  async getOrder(orderId: string): Promise<HermesOrder | null> {
    return this.orders.get(orderId) ?? null;
  }

  async listSessions(): Promise<HermesSession[]> {
    return [...this.sessions.values()].filter((s) => s.terminatedAt === null);
  }

  async cancel(orderId: string, reason: string): Promise<void> {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Unbekannter Auftrag: ${orderId}`);

    this.orders.set(orderId, transitionOrder(order, "cancelled", { failureReason: reason }));
    this.eventLog.append(makeEvent("order-cancelled", orderId, { reason }));
  }

  async createHandoff(
    sessionId: string,
    summary: string,
    remaining: string[],
    completed: string[],
    blockers: string[],
  ): Promise<HandoffPackage> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Unbekannte Session: ${sessionId}`);

    const pkg = createHandoff(
      session.agentId,
      session.taskId,
      session.planId,
      session.headSha,
      summary,
      remaining,
      completed,
      blockers,
    );

    this.handoffs.set(pkg.handoffId, pkg);

    this.eventLog.append(
      makeEvent("handoff-created", session.planId, { handoffId: pkg.handoffId }, sessionId),
    );

    return pkg;
  }

  async *streamEvents(orderId: string): AsyncIterable<HermesEvent> {
    yield* this.eventLog.stream(orderId);
  }

  // ── Interne Helfer für Tests und den Supervisor ─────────────────────────

  /** Startet eine Session für einen Auftrag. Prüft Worktree-Konflikt. */
  _startSession(
    orderId: string,
    agentId: string,
    worktree: string,
    nodeId: string,
  ): HermesSession {
    const conflict = detectWorktreeConflict([...this.sessions.values()], worktree);

    if (conflict) {
      throw new Error(
        `Worktree-Konflikt: ${worktree} wird bereits von Session ${conflict.sessionId} (Agent ${conflict.agentId}) verwendet.`,
      );
    }

    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Unbekannter Auftrag: ${orderId}`);

    const session = createSession(agentId, order.plan.steps[0]?.kind ?? "unknown", order.planId, nodeId, worktree);
    this.sessions.set(session.sessionId, session);

    const updated = transitionOrder(order, "dispatched", { sessionId: session.sessionId });
    this.orders.set(orderId, updated);

    this.eventLog.append(
      makeEvent("session-started", orderId, { sessionId: session.sessionId, agentId }, session.sessionId),
    );

    return session;
  }
}
