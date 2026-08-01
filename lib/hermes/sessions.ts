import type { HermesSession, SessionPhase } from "./types";

/**
 * Session-Verwaltung.
 *
 * Eine Session bindet genau einen Agent an genau einen Worktree.
 * Zwei schreibende Sessions im selben Worktree sind verboten —
 * die Validierung passiert beim Erstellen, nicht erst beim Dispatch.
 */

let _seq = 0;

function nextSessionId(): string {
  return `session-${Date.now()}-${++_seq}`;
}

export function createSession(
  agentId: string,
  taskId: string,
  planId: string,
  nodeId: string,
  worktree: string | null = null,
  leaseDurationMs: number | null = null,
): HermesSession {
  const now = new Date().toISOString();

  const leaseExpiresAt =
    leaseDurationMs != null
      ? new Date(Date.now() + leaseDurationMs).toISOString()
      : null;

  return {
    sessionId: nextSessionId(),
    agentId,
    taskId,
    planId,
    nodeId,
    phase: "initializing",
    headSha: null,
    worktree,
    leaseExpiresAt,
    startedAt: now,
    updatedAt: now,
    terminatedAt: null,
  };
}

export function advancePhase(
  session: HermesSession,
  phase: SessionPhase,
  headSha?: string,
): HermesSession {
  return {
    ...session,
    phase,
    headSha: headSha ?? session.headSha,
    updatedAt: new Date().toISOString(),
    terminatedAt:
      phase === "terminated" ? new Date().toISOString() : session.terminatedAt,
  };
}

export function isLeaseExpired(session: HermesSession, now = new Date()): boolean {
  if (!session.leaseExpiresAt) return false;
  return now.getTime() > new Date(session.leaseExpiresAt).getTime();
}

/**
 * Verhindert zwei schreibende Sessions im selben Worktree.
 * Gibt den Konflikt zurück oder null.
 */
export function detectWorktreeConflict(
  sessions: HermesSession[],
  newWorktree: string,
): HermesSession | null {
  return (
    sessions.find(
      (s) =>
        s.worktree === newWorktree &&
        s.terminatedAt === null &&
        s.phase !== "idle" &&
        s.phase !== "terminated",
    ) ?? null
  );
}
