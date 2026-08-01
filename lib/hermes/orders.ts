import type { HermesOrder, OrderState } from "./types";
import type { SignedExecutionPlan } from "../../lib/schema/homelab";

/**
 * Auftragsverwaltung.
 *
 * Aufträge sind unveränderlich nach ihrer Erstellung — Zustandsänderungen
 * erzeugen neue Objekte. Hermes hält nie zwei aktive Aufträge für denselben
 * Plan gleichzeitig.
 */

let _seq = 0;

function nextOrderId(): string {
  return `order-${Date.now()}-${++_seq}`;
}

export function createOrder(
  plan: SignedExecutionPlan,
  maxRetries = 0,
): HermesOrder {
  const now = new Date().toISOString();
  return {
    orderId: nextOrderId(),
    planId: plan.planId,
    plan,
    state: "pending",
    sessionId: null,
    attempts: 0,
    maxRetries,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    failureReason: null,
  };
}

export function transitionOrder(
  order: HermesOrder,
  next: OrderState,
  opts: { sessionId?: string; failureReason?: string } = {},
): HermesOrder {
  const now = new Date().toISOString();
  return {
    ...order,
    state: next,
    sessionId: opts.sessionId ?? order.sessionId,
    failureReason:
      next === "failed" ? (opts.failureReason ?? order.failureReason) : order.failureReason,
    completedAt:
      next === "completed" || next === "failed" || next === "cancelled"
        ? now
        : order.completedAt,
    updatedAt: now,
  };
}

export function canRetry(order: HermesOrder): boolean {
  return order.state === "failed" && order.attempts < order.maxRetries;
}

export function incrementAttempts(order: HermesOrder): HermesOrder {
  return { ...order, attempts: order.attempts + 1, updatedAt: new Date().toISOString() };
}

/**
 * Prüft ob ein neuer Auftrag für denselben Plan bereits läuft.
 * Hermes lässt keine Duplikate zu.
 */
export function isDuplicate(
  orders: HermesOrder[],
  planId: string,
): boolean {
  return orders.some(
    (o) =>
      o.planId === planId &&
      (o.state === "pending" || o.state === "dispatched" || o.state === "running"),
  );
}
