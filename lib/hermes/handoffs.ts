import type { HandoffPackage } from "./types";

/**
 * Handoff-Pakete.
 *
 * Ein Handoff ist die einzige erlaubte Übergabe zwischen zwei Agents.
 * Es gibt keine andere Form von Agent-zu-Agent-Kommunikation in Hermes.
 * Der Nachfolger liest das Paket und entscheidet dann selbst — er ist
 * nicht verpflichtet dem Vorgänger zu vertrauen, nur zu verstehen was
 * dieser nachweislich getan hat.
 */

let _seq = 0;

function nextHandoffId(): string {
  return `handoff-${Date.now()}-${++_seq}`;
}

export function createHandoff(
  fromAgentId: string,
  taskId: string,
  planId: string,
  lastStableHeadSha: string | null,
  checkpointSummary: string,
  remainingSteps: string[],
  completedSteps: string[],
  blockers: string[],
): HandoffPackage {
  return {
    handoffId: nextHandoffId(),
    fromAgentId,
    toAgentId: null,
    taskId,
    planId,
    lastStableHeadSha,
    checkpointSummary,
    remainingSteps,
    completedSteps,
    blockers,
    createdAt: new Date().toISOString(),
  };
}

export function acceptHandoff(
  pkg: HandoffPackage,
  toAgentId: string,
): HandoffPackage {
  return { ...pkg, toAgentId };
}
