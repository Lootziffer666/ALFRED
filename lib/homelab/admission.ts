import type {
  AdmissionDecision,
  NodeDeclaration,
  PlacementProposal,
  ResourceSnapshot,
  TaskProfile,
} from "../schema/homelab";

/**
 * Admission control (plan §15.4). A placement says a node *could* take a task;
 * admission decides whether it may take it *now*, against a fresh measurement.
 *
 * The order of checks is the policy: a machine somebody is using, a hot or
 * nearly empty battery, and an exclusive job in flight all outrank the
 * question of whether the memory would fit.
 */

export interface AdmissionInput {
  proposal: PlacementProposal;
  node: NodeDeclaration;
  task: TaskProfile;
  snapshot: ResourceSnapshot;
  /** Nodes the planner offered as fallbacks, in order. */
  alternativeNodeIds?: string[];
  /** Whether renting a GPU is currently an option at all. */
  rentedGpuAvailable?: boolean;
  now?: () => Date;
}

const LOW_BATTERY_PERCENT = 30;
const CRITICAL_BATTERY_PERCENT = 15;

function isExpired(snapshot: ResourceSnapshot, now: Date): boolean {
  const takenAt = Date.parse(snapshot.takenAt);
  if (Number.isNaN(takenAt)) return true;
  return now.getTime() > takenAt + snapshot.validForSeconds * 1000;
}

/** Local "HH:MM-HH:MM" windows, wrapping across midnight. */
export function isWithinQuietHours(windows: string[], now: Date): boolean {
  const minutes = now.getHours() * 60 + now.getMinutes();
  return windows.some((window) => {
    const [from, to] = window.split("-");
    const parse = (v: string) => {
      const [h, m] = v.split(":").map(Number);
      return h * 60 + m;
    };
    if (!from || !to) return false;
    const start = parse(from);
    const end = parse(to);
    return start <= end ? minutes >= start && minutes < end : minutes >= start || minutes < end;
  });
}

function decision(
  input: AdmissionInput,
  outcome: AdmissionDecision["outcome"],
  reason: string,
  extra: Partial<AdmissionDecision> = {},
): AdmissionDecision {
  return {
    outcome,
    nodeId: input.node.id,
    task: input.task.id,
    reason,
    decidedAt: (input.now?.() ?? new Date()).toISOString(),
    ...extra,
  };
}

export function decideAdmission(input: AdmissionInput): AdmissionDecision {
  const { proposal, node, task, snapshot } = input;
  const now = input.now?.() ?? new Date();

  if (snapshot.nodeId !== node.id) {
    return decision(input, "not-executable", "Der Snapshot gehört zu einem anderen Node.");
  }

  // An expired measurement is not a measurement. Decide again once it is fresh.
  if (isExpired(snapshot, now)) {
    return decision(input, "wait", "Der Resource Snapshot ist abgelaufen — erst neu messen, dann entscheiden.");
  }

  if (snapshot.thermal === "throttling" || snapshot.thermal === "hot") {
    return decision(input, "wait", `Node ist thermisch belastet (${snapshot.thermal}).`);
  }

  const onBattery = snapshot.onAcPower === false && snapshot.batteryPercent !== undefined;
  if (onBattery && snapshot.batteryPercent! <= CRITICAL_BATTERY_PERCENT) {
    return decision(input, "not-executable", `Akku bei ${snapshot.batteryPercent}% ohne Netzteil.`);
  }
  if (onBattery && snapshot.batteryPercent! <= LOW_BATTERY_PERCENT) {
    return decision(input, "wait", `Akku bei ${snapshot.batteryPercent}% — warten oder anstecken.`);
  }

  if (snapshot.userActive && !node.policy.computeWhileUserActive) {
    return decision(input, "wait", "Jemand arbeitet am Node, und Rechnen während der Benutzung ist nicht freigegeben.");
  }

  if (isWithinQuietHours(node.policy.quietHours, now)) {
    return decision(input, "wait", "Der Node hat gerade Ruhezeit.");
  }

  if (task.exclusive && snapshot.runningJobs > 0) {
    return decision(input, "wait", `Aufgabe verlangt den Node allein, es laufen ${snapshot.runningJobs} Jobs.`);
  }

  // Remote inference needs nothing local beyond the request itself.
  if (proposal.runtime === "remote-openai") {
    return decision(input, "start", "Externer Endpunkt: keine lokalen Ressourcen erforderlich.");
  }

  if (!proposal.memory) {
    return decision(
      input,
      "not-executable",
      "Für diese Platzierung gibt es keine Speicherschätzung — sie wurde nie belegt.",
    );
  }

  const usesGpu = snapshot.freeVramGb > 0 || snapshot.residentModels.length > 0;
  const freeGb = usesGpu ? snapshot.freeVramGb : snapshot.freeRamGb;
  const requiredGb = proposal.memory.expectedGb;

  if (freeGb >= requiredGb) {
    return decision(input, "start", `${freeGb} GB frei, ${requiredGb} GB erwartet.`);
  }

  // Something is resident that would free enough room if unloaded.
  const evictable = [...snapshot.residentModels]
    .filter((m) => m.modelId !== proposal.modelId)
    .sort((a, b) => b.vramGb - a.vramGb);
  const reclaimable = evictable.reduce((sum, m) => sum + m.vramGb, 0);

  if (evictable.length > 0 && freeGb + reclaimable >= requiredGb) {
    return decision(
      input,
      "evict-model",
      `${freeGb} GB frei für ${requiredGb} GB — ${evictable[0].modelId} entladen gibt ${evictable[0].vramGb} GB zurück.`,
      { evictModelId: evictable[0].modelId },
    );
  }

  const alternative = input.alternativeNodeIds?.[0];
  if (alternative) {
    return decision(input, "use-other-node", `${freeGb} GB frei, ${requiredGb} GB nötig — auf ${alternative} ausweichen.`, {
      alternativeNodeId: alternative,
    });
  }

  if (task.shrinkable) {
    return decision(
      input,
      "shrink-task",
      `${freeGb} GB frei, ${requiredGb} GB nötig — die Aufgabe hat eine kleinere Fassung.`,
    );
  }

  if (input.rentedGpuAvailable) {
    return decision(input, "suggest-rented-gpu", `Lokal fehlen ${(requiredGb - freeGb).toFixed(2)} GB.`);
  }

  return decision(
    input,
    "not-executable",
    `${freeGb} GB frei, ${requiredGb} GB nötig, nichts zu entladen und kein Ausweichnode.`,
  );
}
