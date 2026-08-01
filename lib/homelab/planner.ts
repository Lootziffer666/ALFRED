import type { DataClass } from "../schema/common";
import type {
  CheckSpec,
  ModelCandidate,
  ModelCapabilityRecord,
  NodeDeclaration,
  NodeObservation,
  PlacementProposal,
  TaskProfile,
  TaskProfileId,
} from "../schema/homelab";
import { bestModel, rankModels, usableButUnproven, type RankedModel } from "./models";
import { canHostAlwaysOn, chooseRuntime, declaredVramGb, observedVramGb } from "./runtimes";

/**
 * Static planning (plan §14.8). Deterministic and network-free: rules, counts
 * and measurements decide, never a model.
 *
 * The planner refuses in three ways rather than guessing:
 *   - a node whose hardware was never measured yields `not-proven`, not a fit;
 *   - a task that no node may take is reported as unplaced with its reasons;
 *   - a model that fits but was never measured is offered, never chosen.
 */

export interface PlannerNode {
  declaration: NodeDeclaration;
  /** Measured hardware. Absent means nothing here has been verified. */
  observation?: NodeObservation;
}

export interface PlanningInput {
  tasks: TaskProfile[];
  nodes: PlannerNode[];
  models: ModelCandidate[];
  records: ModelCapabilityRecord[];
}

export interface UnplacedTask {
  task: TaskProfileId;
  reasons: string[];
}

export interface PlanningResult {
  proposals: PlacementProposal[];
  unplaced: UnplacedTask[];
}

const DATA_CLASS_ORDER: Record<DataClass, number> = { public: 0, private: 1, secret: 2 };

interface Eligibility {
  eligible: boolean;
  reason?: string;
  warning?: string;
}

/**
 * Policy gates. These are the rules a person set, not something measurable —
 * which is exactly why they are checked before any hardware is considered.
 */
export function checkEligibility(node: NodeDeclaration, task: TaskProfile): Eligibility {
  const where = `${node.name} (${node.trust})`;

  if (node.policy.allowedTasks.length > 0 && !node.policy.allowedTasks.includes(task.id)) {
    return { eligible: false, reason: `${where}: „${task.id}" steht nicht auf der Liste erlaubter Aufgaben.` };
  }

  // Sensitive material never reaches a machine that is not the user's own.
  if (DATA_CLASS_ORDER[task.dataClass] > 0 && node.trust !== "owned") {
    return {
      eligible: false,
      reason: `${where}: Aufgabe ist „${task.dataClass}" — fremde oder gemietete Nodes bekommen sie nicht.`,
    };
  }
  if (DATA_CLASS_ORDER[task.dataClass] > DATA_CLASS_ORDER[node.policy.maxDataClass]) {
    return {
      eligible: false,
      reason: `${where}: höchstens „${node.policy.maxDataClass}" freigegeben, die Aufgabe ist „${task.dataClass}".`,
    };
  }

  if (task.alwaysOn && !canHostAlwaysOn(node)) {
    return {
      eligible: false,
      reason: `${where}: dauerhaft verfügbare Aufgabe gehört nicht auf einen „${node.availability}"-Node.`,
    };
  }

  if (!node.policy.automaticUse) {
    return {
      eligible: true,
      warning: `${where}: nur nach ausdrücklicher Bestätigung nutzbar.`,
    };
  }
  return { eligible: true };
}

/** Owned before borrowed before rented; always-on before on-demand; more VRAM first. */
function nodePreference(a: PlannerNode, b: PlannerNode): number {
  const trust = { owned: 0, borrowed: 1, rented: 2 } as const;
  const avail = { always: 0, intermittent: 1, "on-demand": 2 } as const;

  const byTrust = trust[a.declaration.trust] - trust[b.declaration.trust];
  if (byTrust !== 0) return byTrust;

  const byAvailability = avail[a.declaration.availability] - avail[b.declaration.availability];
  if (byAvailability !== 0) return byAvailability;

  // A measured node outranks one that only claims its hardware.
  const measured = Number(Boolean(b.observation)) - Number(Boolean(a.observation));
  if (measured !== 0) return measured;

  return observedVramGb(b.observation) - observedVramGb(a.observation);
}

function checksFor(task: TaskProfile, modelId: string | null): CheckSpec[] {
  const checks: CheckSpec[] = [
    { id: "runtime-running", description: "Die vorgesehene Runtime läuft und antwortet lokal." },
  ];
  if (modelId) {
    checks.push({ id: "model-loaded", description: `Das Modell ${modelId} ist tatsächlich geladen.` });
    checks.push({ id: "test-inference", description: "Eine Testinferenz liefert das vereinbarte Antwortformat." });
    checks.push({ id: "model-unloaded", description: "Nach dem Stop ist das Modell entladen und der Speicher frei." });
  }
  checks.push({ id: "resources-within-limit", description: `Die Aufgabe „${task.id}" bleibt unter den gesetzten Limits.` });
  return checks;
}

interface NodePlan {
  node: PlannerNode;
  proposal: PlacementProposal;
  quality: number;
}

const FIT_QUALITY = { fits: 0, tight: 1, "not-proven": 2, spills: 3, infeasible: 4 } as const;

function planOnNode(node: PlannerNode, task: TaskProfile, input: PlanningInput, warning?: string): NodePlan {
  const { declaration, observation } = node;
  const runtimeChoice = chooseRuntime({ node: declaration, observation, task });

  const gpuVram = observedVramGb(observation);
  const target: "gpu" | "cpu" = gpuVram > 0 ? "gpu" : "cpu";
  const drivesDisplay = observation?.gpus.some((g) => g.drivesDisplay) ?? false;
  const availableGb = target === "gpu" ? gpuVram : (observation?.ramGb ?? 0);

  const warnings = warning ? [warning] : [];
  const rationale = [runtimeChoice.why];

  // Nothing was measured here, so no fit may be claimed.
  if (!observation) {
    warnings.push(
      `${declaration.name}: Hardware ist nur deklariert (${declaredVramGb(declaration)} GB VRAM behauptet). ` +
        "Ohne Runner-Probe bleibt die Platzierung unbelegt.",
    );
    return {
      node,
      quality: FIT_QUALITY["not-proven"],
      proposal: {
        task: task.id,
        nodeId: declaration.id,
        modelId: null,
        runtime: runtimeChoice.runtime,
        delivery: runtimeChoice.delivery,
        residency: "on-demand",
        fit: "not-proven",
        memory: null,
        evidence: [],
        rationale,
        fallbackNodeIds: [],
        checks: checksFor(task, null),
        warnings,
      },
    };
  }

  const ranked: RankedModel[] = rankModels(input.models, {
    task,
    runtime: runtimeChoice.runtime,
    target,
    availableGb,
    drivesDisplay,
    records: input.records,
  });

  const chosen = bestModel(ranked);
  const offered = chosen ?? usableButUnproven(ranked)[0] ?? null;

  if (!chosen && offered) {
    warnings.push(
      `${offered.candidate.id} passt auf die Hardware, ist für „${task.id}" aber nicht gemessen — ` +
        "Vorschlag, keine Auswahl.",
    );
  }
  if (!offered) {
    const why = ranked[0]?.blockers[0] ?? "Kein Modellkandidat übergeben.";
    warnings.push(`Kein einsetzbares Modell auf ${declaration.name}: ${why}`);
  }

  const fit = offered ? offered.fit : "infeasible";
  if (fit === "tight") {
    warnings.push(
      `Speicher ist knapp: erwartet ${offered!.memory.expectedGb} GB, Spitze ${offered!.memory.maximumGb} GB ` +
        `gegen ${availableGb} GB verfügbar.`,
    );
  }
  if (offered) {
    rationale.push(
      `${offered.candidate.id}: ${offered.suitability === "proven" ? "gemessen" : "ungemessen"}, ` +
        `Fit ${offered.fit} (erwartet ${offered.memory.expectedGb} GB von ${availableGb} GB).`,
    );
  }

  return {
    node,
    quality: FIT_QUALITY[fit],
    proposal: {
      task: task.id,
      nodeId: declaration.id,
      modelId: offered?.candidate.id ?? null,
      runtime: runtimeChoice.runtime,
      delivery: runtimeChoice.delivery,
      // Models stay on demand unless a task must remain continuously available.
      residency: task.alwaysOn ? "always" : "on-demand",
      fit,
      memory: offered?.memory ?? null,
      evidence: offered?.candidate.evidence ?? [],
      rationale,
      fallbackNodeIds: [],
      checks: checksFor(task, offered?.candidate.id ?? null),
      warnings,
    },
  };
}

export function planPlacements(input: PlanningInput): PlanningResult {
  const proposals: PlacementProposal[] = [];
  const unplaced: UnplacedTask[] = [];

  for (const task of input.tasks) {
    const reasons: string[] = [];
    const eligible: { node: PlannerNode; warning?: string }[] = [];

    for (const node of input.nodes) {
      const verdict = checkEligibility(node.declaration, task);
      if (!verdict.eligible) {
        reasons.push(verdict.reason!);
        continue;
      }
      eligible.push({ node, warning: verdict.warning });
    }

    if (eligible.length === 0) {
      unplaced.push({ task: task.id, reasons: reasons.length ? reasons : ["Keine Nodes übergeben."] });
      continue;
    }

    const plans = eligible
      .sort((a, b) => nodePreference(a.node, b.node))
      .map(({ node, warning }) => planOnNode(node, task, input, warning))
      .sort((a, b) => a.quality - b.quality);

    const best = plans[0];

    if (best.proposal.fit === "infeasible") {
      unplaced.push({
        task: task.id,
        reasons: [...reasons, ...best.proposal.warnings],
      });
      continue;
    }

    // A node that was measured and found too small is not a fallback — it is a
    // ruled-out option, and the reason belongs on the proposal rather than in a
    // discarded plan nobody sees.
    const ruledOut = plans.filter((p) => p.quality >= FIT_QUALITY.spills);
    const fallbacks = plans
      .slice(1)
      .filter((p) => p.quality < FIT_QUALITY.spills)
      .map((p) => p.node.declaration.id);

    proposals.push({
      ...best.proposal,
      fallbackNodeIds: fallbacks,
      warnings: [
        ...best.proposal.warnings,
        ...ruledOut.flatMap((p) => p.proposal.warnings.map((w) => `Ausgeschlossen — ${w}`)),
        ...reasons,
      ],
    });
  }

  return { proposals, unplaced };
}
