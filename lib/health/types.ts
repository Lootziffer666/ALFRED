/**
 * Healthchecks, Heartbeats, Fallbacks (Etappe 9c).
 *
 * Heartbeats sind kurze Lebenszeichen laufender Agents oder Runner-Jobs.
 * HealthStatus beschreibt den beobachteten Zustand.
 * FallbackAction beschreibt was als nächstes versucht werden soll —
 * die Entscheidung selbst trifft der Supervisor.
 */

export type HealthStatus =
  | "healthy"
  | "degraded"
  | "stalled"
  | "unresponsive"
  | "dead"
  | "poisoned";

export type FallbackAction =
  | "retry-session"          // Session erneut ansprechen
  | "resume-checkpoint"      // Ab letztem Checkpoint fortsetzen
  | "switch-model"           // Anderes Modell, gleicher Worktree
  | "handoff-new-agent"      // Neuer Agent mit Handoff-Paket
  | "salvage-commits"        // Belegte Commits in frischen Worktree
  | "shrink-task"            // Aufgabe verkleinern
  | "escalate-supervisor"    // Mensch muss entscheiden
  | "abandon";               // Aufgabe aufgeben, Zustand dokumentieren

export interface Heartbeat {
  agentId: string;
  taskId: string;
  sessionId: string;
  phase: string;
  headSha: string | null;
  lastCheckpoint: string | null;
  lastCommand: string | null;
  exitCode: number | null;
  lastEvidence: string | null;
  model: string | null;
  provider: string | null;
  worktree: string | null;
  lease: string | null;
  blocker: string | null;
  status: HealthStatus;
  timestamp: string;
}

export interface HealthCheckResult {
  agentId: string;
  taskId: string;
  status: HealthStatus;
  suggestedFallback: FallbackAction;
  reason: string;
  checkedAt: string;
}
