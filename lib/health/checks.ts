import type { FallbackAction, HealthCheckResult, HealthStatus, Heartbeat } from "./types";

/**
 * Statusermittlung und Fallback-Empfehlung.
 *
 * Die Regeln sind deterministisch. Ein Agent der zu lange nichts meldet
 * wird als "stalled" eingestuft; einer der Widersprüche in seinen
 * Heartbeats produziert als "poisoned". Der Supervisor entscheidet
 * dann auf Basis der Empfehlung — er ist nicht verpflichtet ihr zu folgen.
 */

const STALL_MS = 5 * 60 * 1000;      // 5 Minuten ohne Heartbeat = stalled
const DEAD_MS  = 20 * 60 * 1000;     // 20 Minuten = dead

export function assessHealth(
  last: Heartbeat,
  now: Date = new Date(),
): HealthStatus {
  const age = now.getTime() - new Date(last.timestamp).getTime();

  if (age >= DEAD_MS) return "dead";
  if (age >= STALL_MS) return "stalled";
  if (last.blocker) return "degraded";

  return last.status;
}

export function recommendFallback(status: HealthStatus, hb: Heartbeat): FallbackAction {
  switch (status) {
    case "healthy":   return "retry-session";
    case "degraded":  return "retry-session";
    case "stalled":
      return hb.lastCheckpoint ? "resume-checkpoint" : "handoff-new-agent";
    case "unresponsive":
      return hb.lastCheckpoint ? "resume-checkpoint" : "switch-model";
    case "dead":
      return hb.headSha ? "salvage-commits" : "escalate-supervisor";
    case "poisoned":
      return "escalate-supervisor";
  }
}

export function runHealthCheck(
  hb: Heartbeat,
  now: Date = new Date(),
): HealthCheckResult {
  const status = assessHealth(hb, now);
  const fallback = recommendFallback(status, hb);

  return {
    agentId: hb.agentId,
    taskId: hb.taskId,
    status,
    suggestedFallback: fallback,
    reason: buildReason(status, hb, now),
    checkedAt: now.toISOString(),
  };
}

function buildReason(status: HealthStatus, hb: Heartbeat, now: Date): string {
  const age = Math.round((now.getTime() - new Date(hb.timestamp).getTime()) / 1000);

  switch (status) {
    case "healthy":      return `Agent aktiv (letzter Heartbeat vor ${age}s).`;
    case "degraded":     return `Agent meldet Blocker: ${hb.blocker}.`;
    case "stalled":      return `Kein Heartbeat seit ${age}s — Agent stalled.`;
    case "unresponsive": return `Kein Heartbeat seit ${age}s.`;
    case "dead":         return `Kein Heartbeat seit ${age}s — Agent gilt als dead.`;
    case "poisoned":     return `Agent-Status poisoned: widersprüchliche Signale.`;
  }
}

/**
 * Sicher: Zwei schreibende Agents im selben Branch sind verboten.
 * Gibt true zurück wenn ein Konflikt vorliegt.
 */
export function detectWorktreeConflict(
  heartbeats: Heartbeat[],
): { worktree: string; agents: string[] } | null {
  const active = heartbeats.filter(
    (hb) => hb.status === "healthy" || hb.status === "degraded",
  );

  const byWorktree = new Map<string, string[]>();

  for (const hb of active) {
    if (!hb.worktree) continue;

    const existing = byWorktree.get(hb.worktree) ?? [];
    existing.push(hb.agentId);
    byWorktree.set(hb.worktree, existing);
  }

  for (const [worktree, agents] of byWorktree) {
    if (agents.length > 1) return { worktree, agents };
  }

  return null;
}
