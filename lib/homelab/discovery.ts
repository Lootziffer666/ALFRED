import type {
  DeclaredHardware,
  HardwareReconciliation,
  NodeAvailability,
  NodeDeclaration,
  NodeDiscovery,
  NodeKind,
  NodeObservation,
  NodeOs,
  NodePolicy,
  NodeTrust,
} from "../schema/homelab";

/**
 * Discovery → declaration → observation (plan §13).
 *
 * A discovery is a device that made itself known. It becomes a node only when
 * a person confirms it. What the node then *claims* about its hardware and
 * what a runner later *measures* are kept apart for good: a preset can never
 * be presented as an observation, and a claim nobody measured stays
 * `not_proven` however plausible it looks.
 *
 * There is no scanning here. Devices announce themselves; ALFRET does not go
 * looking through address ranges.
 */

export class UnconfirmedDiscoveryError extends Error {
  constructor(discovery: NodeDiscovery) {
    super(
      `Discovery ${discovery.discoveredId} is "${discovery.pairingStatus}", not confirmed. ` +
        "A node is created only after pairing.",
    );
    this.name = "UnconfirmedDiscoveryError";
  }
}

export interface ConfirmDiscoveryInput {
  id: string;
  name: string;
  kind: NodeKind;
  os: NodeOs;
  trust: NodeTrust;
  availability: NodeAvailability;
  /** What the user or the preset says is in the machine. Never a measurement. */
  declared?: DeclaredHardware;
  policy: NodePolicy;
  createdAt: string;
}

/**
 * Turns a confirmed discovery into a node. Demo fixtures are the one exception
 * to pairing: they are planning assumptions that never pretend to be a device,
 * and everything downstream keeps treating them as unmeasured.
 */
export function confirmDiscovery(discovery: NodeDiscovery, input: ConfirmDiscoveryInput): NodeDeclaration {
  const isFixture = discovery.source === "demo-fixture";
  if (!isFixture && discovery.pairingStatus !== "paired") {
    throw new UnconfirmedDiscoveryError(discovery);
  }

  return {
    id: input.id,
    name: input.name,
    kind: input.kind,
    os: input.os,
    trust: input.trust,
    availability: input.availability,
    declared: input.declared ?? { gpus: [] },
    policy: input.policy,
    discovery,
    createdAt: input.createdAt,
  };
}

/** True only for a device a runner actually reached. */
export function isMeasured(node: NodeDeclaration, observation?: NodeObservation): observation is NodeObservation {
  return observation !== undefined && observation.nodeId === node.id;
}

/** A fixture is a planning assumption, never evidence about a real machine. */
export function isFixtureNode(node: NodeDeclaration): boolean {
  return node.discovery.source === "demo-fixture";
}

const TOLERANCE = 0.1;

function closeEnough(declared: number, observed: number): boolean {
  if (declared === 0) return observed === 0;
  return Math.abs(declared - observed) / declared <= TOLERANCE;
}

function compare(
  field: string,
  declared: string | number | null | undefined,
  observed: string | number | null | undefined,
  numeric = false,
): HardwareReconciliation {
  const d = declared ?? null;
  const o = observed ?? null;

  if (o === null) {
    return {
      field,
      declared: d === null ? null : String(d),
      observed: null,
      truth: "not_proven",
      note: "Keine Messung — die Angabe ist unbelegt.",
    };
  }
  if (d === null) {
    return { field, declared: null, observed: String(o), truth: "observed", note: "Gemessen, aber nie behauptet." };
  }

  const matches = numeric
    ? closeEnough(Number(d), Number(o))
    : String(d).toLowerCase().includes(String(o).toLowerCase()) ||
      String(o).toLowerCase().includes(String(d).toLowerCase());

  return matches
    ? { field, declared: String(d), observed: String(o), truth: "verified" }
    : {
        field,
        declared: String(d),
        observed: String(o),
        truth: "contradicted",
        note: "Behauptung und Messung gehen auseinander — nicht stillschweigend überschrieben.",
      };
}

/**
 * Declaration against observation, field by field. Without an observation
 * every field is `not_proven`; a mismatch becomes `contradicted` and is never
 * quietly replaced by the measured value.
 */
export function reconcileHardware(
  node: NodeDeclaration,
  observation?: NodeObservation,
): HardwareReconciliation[] {
  const measured = isMeasured(node, observation) ? observation : undefined;
  const declaredVram = node.declared.gpus.reduce((max, g) => Math.max(max, g.vramGb), 0) || null;
  const observedVram = measured ? measured.gpus.reduce((max, g) => Math.max(max, g.vramGb), 0) || null : null;

  return [
    compare("cpu", node.declared.cpu, measured?.cpu),
    compare("cores", node.declared.cores, measured?.cores, true),
    compare("ramGb", node.declared.ramGb, measured?.ramGb, true),
    compare("vramGb", declaredVram, observedVram, true),
    compare("diskFreeGb", node.declared.diskFreeGb, measured?.diskFreeGb, true),
  ];
}

/** Fields whose claim the measurement disagreed with. */
export function contradictions(reconciliation: HardwareReconciliation[]): HardwareReconciliation[] {
  return reconciliation.filter((r) => r.truth === "contradicted");
}
