import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type {
  ModelCandidate,
  NodeDeclaration,
  NodeDiscovery,
  NodeObservation,
  ResourceSnapshot,
} from "@/lib/schema/homelab";
import { estimateMemory, fitFor, isPlaceable, residentBudget } from "@/lib/homelab/memory";
import { chooseRuntime, canHostAlwaysOn } from "@/lib/homelab/runtimes";
import { bestModel, rankModels, usableButUnproven } from "@/lib/homelab/models";
import { checkEligibility, planPlacements } from "@/lib/homelab/planner";
import { decideAdmission, isWithinQuietHours } from "@/lib/homelab/admission";
import {
  UnconfirmedDiscoveryError,
  confirmDiscovery,
  contradictions,
  isFixtureNode,
  isMeasured,
  reconcileHardware,
} from "@/lib/homelab/discovery";
import {
  FIXTURE_MODELS,
  FIXTURE_NODES,
  FIXTURE_RECORDS,
  TASK_PROFILES,
  fixtureNode,
  taskProfile,
} from "@/lib/homelab/fixtures";

const AT = "2026-07-31T12:00:00.000Z";
const now = () => new Date(AT);

const model = (id: string): ModelCandidate => {
  const found = FIXTURE_MODELS.find((m) => m.id === id);
  if (!found) throw new Error(`no fixture model ${id}`);
  return found;
};

function observe(nodeId: string, overrides: Partial<NodeObservation> = {}): NodeObservation {
  return {
    nodeId,
    observedAt: AT,
    runnerVersion: "0.1.0",
    cpu: "AMD Ryzen 7 3700X",
    arch: "x86_64",
    cores: 8,
    threads: 16,
    ramGb: 16,
    gpus: [{ vendor: "nvidia", model: "GeForce RTX 3060", vramGb: 12, drivesDisplay: true }],
    os: "windows",
    wsl: true,
    virtualized: false,
    diskFreeGb: 400,
    accelerators: ["cuda"],
    runtimes: [],
    toolchains: [],
    installedModels: [],
    evidence: [],
    ...overrides,
  };
}

function snapshot(nodeId: string, overrides: Partial<ResourceSnapshot> = {}): ResourceSnapshot {
  return {
    nodeId,
    takenAt: AT,
    validForSeconds: 120,
    freeRamGb: 10,
    freeVramGb: 11,
    cpuLoad: 0.1,
    gpuLoad: 0.05,
    diskFreeGb: 400,
    runningJobs: 0,
    residentModels: [],
    thermal: "cool",
    userActive: false,
    ...overrides,
  };
}

describe("memory is a range, not a number", () => {
  it("counts the KV cache, the runtime and the display, not just the weights", () => {
    const estimate = estimateMemory({
      model: model("mid-8b-q4"),
      contextTokens: 8000,
      runtime: "ollama",
      target: "gpu",
      drivesDisplay: true,
    });

    expect(estimate.expectedGb).toBeGreaterThan(model("mid-8b-q4").fileSizeGb);
    expect(estimate.maximumGb).toBeGreaterThan(estimate.expectedGb);
    expect(estimate.minimumGb).toBeLessThan(estimate.expectedGb);
    expect(estimate.confidence).toBe("high");
    expect(estimate.breakdown.map((b) => b.label)).toEqual(
      expect.arrayContaining([expect.stringContaining("KV-Cache"), "Display-Reserve", "Accelerator-Kontext"]),
    );
  });

  it("does not call a model that merely averages under the limit a fit", () => {
    // ~11 GB expected against a 12 GB card: the usual case fits, a peak does not.
    const estimate = estimateMemory({
      model: model("mid-8b-q4"),
      contextTokens: 8000,
      runtime: "ollama",
      target: "gpu",
      drivesDisplay: true,
    });

    expect(estimate.expectedGb).toBeLessThan(12);
    expect(estimate.maximumGb).toBeGreaterThan(12);
    expect(fitFor(estimate, 12)).toBe("tight");
    expect(isPlaceable(fitFor(estimate, 12))).toBe(false);
    // The same model on a card with real headroom is a different matter.
    expect(fitFor(estimate, 24)).toBe("fits");
  });

  it("calls a model that cannot possibly hold infeasible", () => {
    const estimate = estimateMemory({
      model: model("large-32b-q4"),
      contextTokens: 32000,
      runtime: "ollama",
      target: "gpu",
    });
    expect(fitFor(estimate, 12)).toBe("infeasible");
  });

  it("lowers its confidence when the model does not state its shape", () => {
    const vague = { ...model("mid-8b-q4"), layers: undefined, hiddenSize: undefined };
    expect(estimateMemory({ model: vague, contextTokens: 8000, runtime: "ollama", target: "gpu" }).confidence).toBe(
      "medium",
    );

    const veryVague = { ...vague, paramsB: undefined };
    expect(
      estimateMemory({ model: veryVague, contextTokens: 8000, runtime: "ollama", target: "gpu" }).confidence,
    ).toBe("low");
  });

  it("refuses to keep two models resident beyond the budget", () => {
    const each = estimateMemory({
      model: model("small-3b-q4"),
      contextTokens: 8000,
      runtime: "ollama",
      target: "gpu",
      drivesDisplay: true,
    });

    // One at a time is fine — which is exactly what eviction is for.
    expect(residentBudget([each], 12).ok).toBe(true);

    const two = residentBudget([each, each], 12);
    expect(two.ok).toBe(false);
    expect(two.requiredGb).toBeGreaterThan(12);
  });
});

describe("runtime choice", () => {
  it("puts Android on Termux and never on a service that keeps running", () => {
    const choice = chooseRuntime({
      node: fixtureNode("phone"),
      observation: observe("phone", { os: "android", gpus: [], accelerators: [] }),
      task: taskProfile("documentation.reconcile"),
    });
    expect(choice.runtime).toBe("termux-llama.cpp");
    expect(choice.delivery).toBe("termux-service");
  });

  it("uses Ollama as the Windows standard when CUDA was actually measured", () => {
    const choice = chooseRuntime({
      node: fixtureNode("workstation"),
      observation: observe("workstation"),
      task: taskProfile("repository.reasoning"),
    });
    expect(choice.runtime).toBe("ollama");
    expect(choice.delivery).toBe("windows-service");
  });

  it("puts a rented Linux GPU on vLLM in a container that leaves nothing behind", () => {
    const choice = chooseRuntime({
      node: fixtureNode("rented"),
      observation: observe("rented", {
        os: "linux",
        gpus: [{ vendor: "nvidia", model: "L4", vramGb: 24, drivesDisplay: false }],
      }),
      task: taskProfile("model.inference"),
    });
    expect(choice.runtime).toBe("vllm");
    expect(choice.delivery).toBe("ephemeral-container");
  });

  it("falls back to the CPU when no accelerator was measured, however much was claimed", () => {
    // The workstation *claims* a 12 GB card; without a probe it gets the CPU path.
    const choice = chooseRuntime({
      node: fixtureNode("workstation"),
      task: taskProfile("repository.reasoning"),
    });
    expect(choice.runtime).toBe("llama.cpp");
  });

  it("lets only an owned, always-on node carry something indispensable", () => {
    expect(canHostAlwaysOn(fixtureNode("workstation"))).toBe(true);
    expect(canHostAlwaysOn(fixtureNode("laptop"))).toBe(false);
    expect(canHostAlwaysOn(fixtureNode("rented"))).toBe(false);
  });
});

describe("model choice", () => {
  const ctx = {
    task: taskProfile("repository.reasoning"),
    runtime: "ollama" as const,
    target: "gpu" as const,
    availableGb: 24,
    records: [...FIXTURE_RECORDS],
  };

  it("never calls a model best just because it fits the hardware", () => {
    const withoutRecords = rankModels([...FIXTURE_MODELS], { ...ctx, records: [] });
    const placeable = withoutRecords.filter((r) => r.blockers.length === 0);

    expect(placeable.length).toBeGreaterThan(0);
    expect(bestModel(withoutRecords)).toBeNull();
    for (const r of placeable) {
      expect(r.suitability).toBe("unproven");
      expect(r.score).toBeNull();
    }
    expect(usableButUnproven(withoutRecords).length).toBeGreaterThan(0);
  });

  it("promotes a model only once it was measured for this very task", () => {
    // 8B at 32k context needs well past 24 GB once the KV cache is counted,
    // so this asks about suitability on a card that genuinely has the room.
    const roomy = { ...ctx, availableGb: 40 };

    const best = bestModel(rankModels([...FIXTURE_MODELS], roomy));
    expect(best?.candidate.id).toBe("mid-8b-q4");
    expect(best?.suitability).toBe("proven");
    expect(best?.score).toBeGreaterThan(0);

    // The same model, measured for a different task, proves nothing here.
    const otherTask = rankModels([...FIXTURE_MODELS], { ...roomy, task: taskProfile("blender.pipeline") });
    expect(bestModel(otherTask)).toBeNull();
  });

  it("will not choose a model whose peak exceeds the card, even when measured", () => {
    // Same measured model, same task, 24 GB: the KV cache alone makes it tight.
    const ranked = rankModels([model("mid-8b-q4")], ctx);
    expect(ranked[0].fit).toBe("tight");
    expect(bestModel(ranked)).toBeNull();
  });

  it("treats a published claim as unproven, not as a measurement", () => {
    const ranked = rankModels([model("small-3b-q4")], {
      ...ctx,
      task: taskProfile("donor.search"),
      records: [
        { ...FIXTURE_RECORDS[1], modelId: "small-3b-q4", task: "donor.search", source: "published" },
      ],
    });
    expect(ranked[0].suitability).toBe("published-only");
    expect(ranked[0].score).toBeNull();
    expect(bestModel(ranked)).toBeNull();
  });

  it("blocks a gated model and one whose licence nobody read", () => {
    const gated = rankModels([model("gated-13b")], { ...ctx, runtime: "vllm" })[0];
    expect(gated.blockers.join(" ")).toMatch(/gated/);
    expect(gated.blockers.join(" ")).toMatch(/Lizenz/);

    const unknownLicense = rankModels([{ ...model("mid-8b-q4"), license: "unknown" as const }], ctx)[0];
    expect(unknownLicense.blockers.join(" ")).toMatch(/Lizenz unbekannt/);
    expect(bestModel([unknownLicense])).toBeNull();
  });

  it("blocks a model whose context is shorter than the task needs", () => {
    const short = rankModels([{ ...model("mid-8b-q4"), contextLength: 4096 }], ctx)[0];
    expect(short.blockers.join(" ")).toMatch(/Kontext zu kurz/);
  });
});

describe("eligibility", () => {
  it("keeps private and secret work off borrowed and rented machines", () => {
    for (const id of ["borrowed", "rented"]) {
      const verdict = checkEligibility(fixtureNode(id), taskProfile("typescript.patch"));
      expect(verdict.eligible, `${id} must not take private work`).toBe(false);
      expect(verdict.reason).toMatch(/private/);
    }
    // Public work is a different question.
    expect(checkEligibility(fixtureNode("rented"), taskProfile("model.inference")).eligible).toBe(true);
  });

  it("keeps an indispensable service off an on-demand node", () => {
    const alwaysOn = taskProfile("embedding.build");
    expect(alwaysOn.alwaysOn).toBe(true);
    expect(checkEligibility(fixtureNode("phone"), alwaysOn).eligible).toBe(false);
    expect(checkEligibility(fixtureNode("laptop"), alwaysOn).reason).toMatch(/intermittent/);
    expect(checkEligibility(fixtureNode("nas"), alwaysOn).eligible).toBe(true);
  });

  it("honours a node's own list of allowed tasks", () => {
    expect(checkEligibility(fixtureNode("nas"), taskProfile("blender.pipeline")).eligible).toBe(false);
    expect(checkEligibility(fixtureNode("nas"), taskProfile("embedding.build")).eligible).toBe(true);
  });

  it("marks a node that needs confirmation instead of silently using it", () => {
    const verdict = checkEligibility(fixtureNode("rented"), taskProfile("model.inference"));
    expect(verdict.eligible).toBe(true);
    expect(verdict.warning).toMatch(/Bestätigung/);
  });
});

describe("planner", () => {
  const models = [...FIXTURE_MODELS];
  const records = [...FIXTURE_RECORDS];

  it("claims no fit for hardware that was never measured", () => {
    const { proposals } = planPlacements({
      tasks: [taskProfile("repository.reasoning")],
      nodes: [{ declaration: fixtureNode("workstation") }],
      models,
      records,
    });

    expect(proposals[0].fit).toBe("not-proven");
    expect(proposals[0].modelId).toBeNull();
    expect(proposals[0].warnings.join(" ")).toMatch(/nur deklariert/);
  });

  it("plans against measured hardware and explains itself", () => {
    const { proposals } = planPlacements({
      tasks: [taskProfile("donor.evaluate")],
      nodes: [{ declaration: fixtureNode("workstation"), observation: observe("workstation") }],
      models,
      records,
    });

    const proposal = proposals[0];
    expect(proposal.nodeId).toBe("workstation");
    expect(proposal.runtime).toBe("ollama");
    expect(proposal.rationale.length).toBeGreaterThan(0);
    expect(proposal.checks.map((c) => c.id)).toContain("resources-within-limit");
  });

  it("keeps models on demand unless the task must stay available", () => {
    const { proposals } = planPlacements({
      tasks: [taskProfile("donor.evaluate"), taskProfile("embedding.build")],
      nodes: [
        { declaration: fixtureNode("workstation"), observation: observe("workstation") },
        { declaration: fixtureNode("nas"), observation: observe("nas", { gpus: [], accelerators: [], ramGb: 4 }) },
      ],
      models,
      records,
    });

    const byTask = new Map(proposals.map((p) => [p.task, p]));
    expect(byTask.get("donor.evaluate")!.residency).toBe("on-demand");
    expect(byTask.get("embedding.build")!.residency).toBe("always");
  });

  it("reports a task it may not place anywhere, with the reasons", () => {
    const { proposals, unplaced } = planPlacements({
      tasks: [taskProfile("typescript.patch")],
      nodes: [{ declaration: fixtureNode("rented"), observation: observe("rented", { os: "linux" }) }],
      models,
      records,
    });

    expect(proposals).toEqual([]);
    expect(unplaced[0].task).toBe("typescript.patch");
    expect(unplaced[0].reasons.join(" ")).toMatch(/gemietete Nodes bekommen sie nicht/);
  });

  it("offers an unmeasured model without choosing it", () => {
    const { proposals } = planPlacements({
      tasks: [taskProfile("model.inference")],
      nodes: [{ declaration: fixtureNode("workstation"), observation: observe("workstation") }],
      models,
      records: [],
    });

    expect(proposals[0].modelId).not.toBeNull();
    expect(proposals[0].warnings.join(" ")).toMatch(/nicht gemessen — Vorschlag, keine Auswahl/);
  });

  it("never offers a measured, too-small node as a fallback — it rules it out and says why", () => {
    // 8B at 32k context needs far past 12 GB once the KV cache is counted, so
    // the measured workstation is out. The unmeasured laptop is the only thing
    // left, and the reason the better machine lost must travel with it.
    const { proposals } = planPlacements({
      tasks: [taskProfile("repository.reasoning")],
      nodes: [
        { declaration: fixtureNode("workstation"), observation: observe("workstation") },
        { declaration: fixtureNode("laptop") },
      ],
      models,
      records,
    });

    const proposal = proposals[0];
    expect(proposal.nodeId).toBe("laptop");
    expect(proposal.fit).toBe("not-proven");
    expect(proposal.fallbackNodeIds).not.toContain("workstation");
    expect(proposal.warnings.join(" ")).toMatch(/Ausgeschlossen — .*Windows-PC.*infeasible/);
  });

  it("prefers an owned node and keeps the rest as an ordered fallback chain", () => {
    const { proposals } = planPlacements({
      tasks: [taskProfile("model.inference")],
      nodes: [
        {
          declaration: fixtureNode("rented"),
          observation: observe("rented", {
            os: "linux",
            gpus: [{ vendor: "nvidia", model: "L4", vramGb: 24, drivesDisplay: false }],
          }),
        },
        { declaration: fixtureNode("workstation"), observation: observe("workstation") },
      ],
      models,
      records,
    });

    expect(proposals[0].nodeId).toBe("workstation");
    expect(proposals[0].fallbackNodeIds).toEqual(["rented"]);
  });
});

describe("admission control", () => {
  const task = taskProfile("donor.evaluate");
  const base = planPlacements({
    tasks: [task],
    nodes: [{ declaration: fixtureNode("workstation"), observation: observe("workstation") }],
    models: [...FIXTURE_MODELS],
    records: [...FIXTURE_RECORDS],
  }).proposals[0];

  const input = (overrides: Partial<ResourceSnapshot> = {}, extra = {}) => ({
    proposal: base,
    node: fixtureNode("workstation"),
    task,
    snapshot: snapshot("workstation", overrides),
    now,
    ...extra,
  });

  it("starts when the node is idle and the memory is there", () => {
    expect(decideAdmission(input()).outcome).toBe("start");
  });

  it("waits rather than deciding on a measurement that has expired", () => {
    const decision = decideAdmission(input({ takenAt: "2026-07-31T11:00:00.000Z", validForSeconds: 60 }));
    expect(decision.outcome).toBe("wait");
    expect(decision.reason).toMatch(/abgelaufen/);
  });

  it("waits while somebody is using the machine", () => {
    expect(decideAdmission(input({ userActive: true })).outcome).toBe("wait");
  });

  it("waits when the node is hot and stops entirely on a nearly empty battery", () => {
    expect(decideAdmission(input({ thermal: "throttling" })).outcome).toBe("wait");
    expect(decideAdmission(input({ batteryPercent: 25, onAcPower: false })).outcome).toBe("wait");
    expect(decideAdmission(input({ batteryPercent: 9, onAcPower: false })).outcome).toBe("not-executable");
  });

  it("waits for an exclusive task while another job runs", () => {
    const exclusive = taskProfile("merge.conflict-repair");
    const decision = decideAdmission({ ...input({ runningJobs: 1 }), task: exclusive });
    expect(decision.outcome).toBe("wait");
  });

  it("unloads a resident model rather than giving up, so the two run in sequence", () => {
    const decision = decideAdmission(
      input({ freeVramGb: 2, residentModels: [{ modelId: "large-32b-q4", vramGb: 9 }] }),
    );
    expect(decision.outcome).toBe("evict-model");
    expect(decision.evictModelId).toBe("large-32b-q4");
  });

  it("moves to another node before shrinking the task", () => {
    const decision = decideAdmission(input({ freeVramGb: 1 }, { alternativeNodeIds: ["borrowed"] }));
    expect(decision.outcome).toBe("use-other-node");
    expect(decision.alternativeNodeId).toBe("borrowed");
  });

  it("shrinks a task that has a smaller fassung before looking further afield", () => {
    expect(taskProfile("donor.evaluate").shrinkable).toBe(true);
    expect(decideAdmission(input({ freeVramGb: 1 }, { rentedGpuAvailable: true })).outcome).toBe("shrink-task");
  });

  it("suggests renting only when nothing local is left and the task cannot shrink", () => {
    const rigid = taskProfile("merge.conflict-repair");
    expect(rigid.shrinkable).toBe(false);

    expect(
      decideAdmission({ ...input({ freeVramGb: 1 }, { rentedGpuAvailable: true }), task: rigid }).outcome,
    ).toBe("suggest-rented-gpu");
    expect(decideAdmission({ ...input({ freeVramGb: 1 }), task: rigid }).outcome).toBe("not-executable");
  });

  it("refuses a placement that never had a memory estimate", () => {
    const decision = decideAdmission({ ...input(), proposal: { ...base, memory: null } });
    expect(decision.outcome).toBe("not-executable");
    expect(decision.reason).toMatch(/nie belegt/);
  });

  it("reads quiet-hour windows, including those crossing midnight", () => {
    expect(isWithinQuietHours(["23:00-07:00"], new Date("2026-07-31T23:30:00"))).toBe(true);
    expect(isWithinQuietHours(["23:00-07:00"], new Date("2026-07-31T03:00:00"))).toBe(true);
    expect(isWithinQuietHours(["23:00-07:00"], new Date("2026-07-31T12:00:00"))).toBe(false);
  });
});

describe("discovery, declaration and observation", () => {
  const discovery = (overrides: Partial<NodeDiscovery> = {}): NodeDiscovery => ({
    discoveredId: "mdns:alfret-runner-1",
    source: "mdns",
    address: "alfret-runner-1.local:7717",
    runnerVersion: "0.1.0",
    firstSeenAt: AT,
    lastSeenAt: AT,
    pairingStatus: "discovered",
    ...overrides,
  });

  const details = {
    id: "found-1",
    name: "Gefundener Runner",
    kind: "workstation" as const,
    os: "linux" as const,
    trust: "owned" as const,
    availability: "always" as const,
    policy: fixtureNode("workstation").policy,
    createdAt: AT,
  };

  it("creates no node from a discovery nobody confirmed", () => {
    for (const status of ["discovered", "pairing-required", "rejected", "expired"] as const) {
      expect(() => confirmDiscovery(discovery({ pairingStatus: status }), details)).toThrow(
        UnconfirmedDiscoveryError,
      );
    }
  });

  it("creates a node once the device is paired, and keeps the discovery on it", () => {
    const node = confirmDiscovery(discovery({ pairingStatus: "paired" }), details);
    expect(node.id).toBe("found-1");
    expect(node.discovery.source).toBe("mdns");
    expect(node.discovery.pairingStatus).toBe("paired");
  });

  it("leaves declared hardware unproven while nothing has measured it", () => {
    const node: NodeDeclaration = fixtureNode("workstation");
    const reconciliation = reconcileHardware(node);
    expect(reconciliation.every((r) => r.truth === "not_proven")).toBe(true);
    expect(isMeasured(node, undefined)).toBe(false);
  });

  it("verifies what matches and contradicts what does not, without overwriting the claim", () => {
    const node = fixtureNode("workstation");
    const reconciliation = reconcileHardware(
      node,
      observe("workstation", {
        gpus: [{ vendor: "nvidia", model: "GeForce RTX 3060", vramGb: 8, drivesDisplay: true }],
      }),
    );

    const byField = new Map(reconciliation.map((r) => [r.field, r]));
    expect(byField.get("ramGb")!.truth).toBe("verified");
    expect(byField.get("cpu")!.truth).toBe("verified");

    const vram = byField.get("vramGb")!;
    expect(vram.truth).toBe("contradicted");
    expect(vram.declared).toBe("12");
    expect(vram.observed).toBe("8");
    expect(contradictions(reconciliation).map((r) => r.field)).toEqual(["vramGb"]);
  });

  it("records what was measured but never claimed, so nobody has to type it in", () => {
    const bare = confirmDiscovery(discovery({ pairingStatus: "paired" }), { ...details, declared: { gpus: [] } });
    const reconciliation = reconcileHardware(bare, observe("found-1"));
    const byField = new Map(reconciliation.map((r) => [r.field, r]));

    expect(byField.get("cpu")!.truth).toBe("observed");
    expect(byField.get("cpu")!.observed).toBe("AMD Ryzen 7 3700X");
    expect(byField.get("cpu")!.declared).toBeNull();
  });

  it("marks every preset as a fixture and never as something observed", () => {
    for (const node of FIXTURE_NODES) {
      expect(node.discovery.source).toBe("demo-fixture");
      expect(isFixtureNode(node)).toBe(true);
      expect(node.discovery.pairingStatus).not.toBe("paired");
      expect(reconcileHardware(node).every((r) => r.truth === "not_proven")).toBe(true);
    }
  });

  it("has no code path that walks an address range", () => {
    const dir = path.resolve(__dirname, "../lib/homelab");
    for (const file of readdirSync(dir)) {
      const source = readFileSync(path.join(dir, file), "utf8");
      expect(source, `${file} looks like it scans a network`).not.toMatch(/\/(?:8|16|24)\b|portscan|scanRange|nmap/i);
    }
  });
});

describe("fixtures", () => {
  it("covers the whole task catalogue exactly once", () => {
    expect(TASK_PROFILES).toHaveLength(12);
    expect(new Set(TASK_PROFILES.map((t) => t.id)).size).toBe(12);
    expect(() => taskProfile("model.inference")).not.toThrow();
  });

  it("describes the actual homelab, and refuses an unknown node", () => {
    expect(FIXTURE_NODES.map((n) => n.id)).toEqual([
      "workstation",
      "laptop",
      "nas",
      "borrowed",
      "rented",
      "phone",
    ]);
    expect(fixtureNode("workstation").declared.gpus[0].vramGb).toBe(12);
    expect(() => fixtureNode("nope")).toThrow(/Unknown fixture node/);
  });
});
