import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomelabClient } from "@/components/homelab/HomelabClient";
import { planToJson, planToMarkdown } from "@/lib/homelab/export";
import { planPlacements } from "@/lib/homelab/planner";
import { FIXTURE_MODELS, FIXTURE_RECORDS, fixtureNode, taskProfile } from "@/lib/homelab/fixtures";
import { exportCorpus, createCorpus } from "@/lib/corpus/snapshot";
import type { NodeObservation } from "@/lib/schema/homelab";
import type { ProjectEntry } from "@/lib/schema/corpus";

const AT = "2026-07-31T12:00:00.000Z";

const OBSERVATION: NodeObservation = {
  nodeId: "workstation",
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
};

async function step(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(screen.getByRole("button", { name }));
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Raum IX · Werkstatt", () => {
  it("opens on finding devices, not on a list of presets", () => {
    render(<HomelabClient />);
    expect(screen.getByRole("button", { name: /1\. Geräte finden/ })).toHaveAttribute("aria-current", "step");
    expect(screen.getByText(/Noch keine Geräte/)).toBeInTheDocument();
    expect(screen.getByText(/sucht keine Adressbereiche ab/)).toBeInTheDocument();
  });

  it("says plainly that it executes nothing at this stage", () => {
    render(<HomelabClient />);
    expect(screen.getByText(/installiert nichts, startet nichts und prüft nichts/)).toBeInTheDocument();
  });

  it("loads the demo devices and marks each as a fixture, not as measured", async () => {
    const user = userEvent.setup();
    render(<HomelabClient />);
    await step(user, /Demo-Geräte laden/);

    expect(await screen.findByText("Windows-PC")).toBeInTheDocument();
    expect(screen.getAllByText("demo-fixture")).toHaveLength(6);
    expect(screen.getAllByText(/skipped/).length).toBeGreaterThan(0);
  });

  it("takes a described device, and leaves its hardware unproven", async () => {
    const user = userEvent.setup();
    render(<HomelabClient />);

    await user.type(screen.getByLabelText("Gerätename"), "Werkstatt-Kiste");
    await user.type(screen.getByLabelText("VRAM in GB"), "16");
    await step(user, /Gerät hinzufügen/);

    expect(await screen.findByText("Werkstatt-Kiste")).toBeInTheDocument();

    await step(user, /2\. Hardware prüfen/);
    expect(screen.getByText(/Selbst beschrieben, nicht gemessen/)).toBeInTheDocument();
    expect(screen.getAllByText("not_proven").length).toBeGreaterThan(0);
  });

  it("remembers a runner address but refuses to make a node of it", async () => {
    const user = userEvent.setup();
    render(<HomelabClient />);

    await user.type(screen.getByLabelText("Runner-Adresse"), "alfret-runner.local:7717");
    await step(user, /Vormerken/);

    expect(await screen.findByText(/Pairing steht aus/)).toBeInTheDocument();
    // Still no node: pairing belongs to the runner stage.
    expect(screen.getByText(/Noch keine Geräte/)).toBeInTheDocument();
  });

  it("accepts a runner observation and shows what it contradicts", async () => {
    const user = userEvent.setup();
    render(<HomelabClient />);
    await step(user, /Demo-Geräte laden/);
    await step(user, /2\. Hardware prüfen/);

    const contradicting = { ...OBSERVATION, gpus: [{ ...OBSERVATION.gpus[0], vramGb: 8 }] };
    await user.click(screen.getByLabelText("NodeObservation JSON"));
    await user.paste(JSON.stringify(contradicting));
    await step(user, /Beobachtung übernehmen/);

    expect(await screen.findByText(/Beobachtung für workstation übernommen/)).toBeInTheDocument();
    expect(screen.getAllByText("contradicted").length).toBe(1);
    expect(screen.getByText(/ALFRET überschreibt die Angabe nicht/)).toBeInTheDocument();
    expect(screen.getAllByText("verified").length).toBeGreaterThan(0);
  });

  it("rejects an observation that is not a valid probe", async () => {
    const user = userEvent.setup();
    render(<HomelabClient />);
    await step(user, /Demo-Geräte laden/);
    await step(user, /2\. Hardware prüfen/);

    await user.click(screen.getByLabelText("NodeObservation JSON"));
    await user.paste('{"nodeId":"workstation"}');
    await step(user, /Beobachtung übernehmen/);

    expect(await screen.findByText(/entspricht nicht dem NodeObservation-Schema/)).toBeInTheDocument();
  });

  it("warns on a borrowed node that sensitive work never lands there", async () => {
    const user = userEvent.setup();
    render(<HomelabClient />);
    await step(user, /Demo-Geräte laden/);
    await step(user, /3\. Nutzungsregeln/);

    // Both the borrowed rig and the rented GPU carry the warning.
    expect(screen.getAllByText(/private und geheime Aufgaben kommen hier grundsätzlich nicht hin/)).toHaveLength(2);
    expect(screen.getByText(/Das hier kann kein Runner messen/)).toBeInTheDocument();
  });

  it("derives needs from the project corpus only", async () => {
    const corpus = createCorpus();
    const project: ProjectEntry = {
      corpus: "project",
      repo: { owner: "Lootziffer666", name: "SHADED" },
      addedAt: AT,
      capabilities: [{ id: "blender-export", label: "Blender-Export", truth: "declared", evidenceIds: [] }],
    };
    corpus.project.push(project);
    corpus.donor.push({
      corpus: "donor",
      repo: { owner: "octo", name: "editor" },
      addedAt: AT,
      origin: "star",
      capabilities: [{ id: "node-editor", label: "Node-Editor", truth: "declared", evidenceIds: [] }],
    });

    const user = userEvent.setup();
    render(<HomelabClient />);
    await step(user, /4\. Bedarf/);

    await user.click(screen.getByLabelText("Korpus JSON"));
    await user.paste(exportCorpus(corpus, AT));
    await step(user, /Korpus lesen/);

    expect(await screen.findByText(/Donor \(1\) und extern \(0\) erzeugen keinen Bedarf/)).toBeInTheDocument();
    expect(screen.getByText("blender-export")).toBeInTheDocument();
    expect(screen.queryByText("node-editor")).not.toBeInTheDocument();
  });

  it("refuses to rank models while no GPU has been measured", async () => {
    const user = userEvent.setup();
    render(<HomelabClient />);
    await step(user, /Demo-Geräte laden/);
    await step(user, /5\. Modelle/);

    expect(screen.getByText(/Ohne Messung lässt sich kein Fit behaupten/)).toBeInTheDocument();
  });

  it("plans against measured hardware and shows the memory breakdown", async () => {
    const user = userEvent.setup();
    render(<HomelabClient />);
    await step(user, /Demo-Geräte laden/);

    await step(user, /2\. Hardware prüfen/);
    await user.click(screen.getByLabelText("NodeObservation JSON"));
    await user.paste(JSON.stringify(OBSERVATION));
    await step(user, /Beobachtung übernehmen/);

    await step(user, /4\. Bedarf/);
    await user.click(screen.getByLabelText("donor.evaluate"));

    await step(user, /6\. Plan/);
    const card = await screen.findByText(/donor\.evaluate → workstation/);
    const section = card.closest("section")!;
    expect(within(section).getByText("fits")).toBeInTheDocument();
    expect(within(section).getByText(/Gewichte:/)).toBeInTheDocument();
    expect(within(section).getByText(/KV-Cache/)).toBeInTheDocument();
    expect(within(section).getByText(/Display-Reserve/)).toBeInTheDocument();
  });

  it("shows why a task could not be placed at all", async () => {
    const user = userEvent.setup();
    render(<HomelabClient />);

    // A borrowed machine only, and a task that touches private material.
    await user.type(screen.getByLabelText("Gerätename"), "Leihrechner");
    await user.selectOptions(screen.getByLabelText("Vertrauen"), "borrowed");
    await step(user, /Gerät hinzufügen/);

    await step(user, /4\. Bedarf/);
    await user.click(screen.getByLabelText("typescript.patch"));
    await step(user, /6\. Plan/);

    expect(await screen.findByText(/typescript\.patch — nicht platziert/)).toBeInTheDocument();
    expect(screen.getByText(/gemietete Nodes bekommen sie nicht/)).toBeInTheDocument();
  });

  it("offers both export formats once a plan exists", async () => {
    const user = userEvent.setup();
    render(<HomelabClient />);
    await step(user, /7\. Export/);

    expect(screen.getByRole("button", { name: /Markdown/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /JSON/ })).toBeInTheDocument();
    expect(screen.getByText(/Ausgeführt wurde\s+nichts davon/)).toBeInTheDocument();
  });
});

describe("plan export", () => {
  const nodes = [{ declaration: fixtureNode("workstation"), observation: OBSERVATION }];
  const planning = planPlacements({
    tasks: [taskProfile("donor.evaluate")],
    nodes,
    models: [...FIXTURE_MODELS],
    records: [...FIXTURE_RECORDS],
  });
  const input = { nodes, planning, exportedAt: AT };

  // The NAS allows only two task classes, so anything else has nowhere to go.
  const nasNodes = [{ declaration: fixtureNode("nas") }];
  const refusedInput = {
    nodes: nasNodes,
    planning: planPlacements({
      tasks: [taskProfile("donor.evaluate")],
      nodes: nasNodes,
      models: [...FIXTURE_MODELS],
      records: [...FIXTURE_RECORDS],
    }),
    exportedAt: AT,
  };

  it("writes the claim-versus-measurement table and the memory breakdown", () => {
    const md = planToMarkdown(input);
    expect(md).toContain("# ALFRET · Raum IX — Plan");
    expect(md).toContain("| Feld | Behauptet | Gemessen | Status |");
    expect(md).toContain("| vramGb | 12 | 12 | verified |");
    expect(md).toContain("KV-Cache");
  });

  it("carries the unplaced tasks and their reasons", () => {
    const md = planToMarkdown(refusedInput);
    expect(md).toContain("## Nicht platziert");
    expect(md).toContain("donor.evaluate");
    expect(md).toContain("steht nicht auf der Liste erlaubter Aufgaben");
  });

  it("states what the plan does not claim", () => {
    const md = planToMarkdown(input);
    expect(md).toContain("Nichts wurde installiert, gestartet oder geprüft.");
    expect(md).toContain("Ein ungemessenes Modell ist ein Vorschlag, keine Auswahl.");
  });

  it("writes JSON that keeps declaration, observation and reconciliation apart", () => {
    const json = JSON.parse(planToJson(input));
    expect(json.version).toBe(1);
    expect(json.nodes[0].declaration.id).toBe("workstation");
    expect(json.nodes[0].observation.nodeId).toBe("workstation");
    expect(json.nodes[0].reconciliation.find((r: { field: string }) => r.field === "vramGb").truth).toBe("verified");
    expect(json.proposals[0].task).toBe("donor.evaluate");
    expect(JSON.parse(planToJson(refusedInput)).unplaced.length).toBeGreaterThan(0);
  });
});

describe("Runner installieren", () => {
  it("shows one command per platform and downloadable script", async () => {
    const user = userEvent.setup();
    render(<HomelabClient />);

    expect(screen.getByText(/Ein Befehl, einmal auf dem Gerät/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /alfret-runner-bootstrap\.ps1/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "linux" }));
    expect(await screen.findByRole("button", { name: /alfret-runner-bootstrap\.sh/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "android" }));
    expect(await screen.findByRole("button", { name: /termux/ })).toBeInTheDocument();
  });

  it("states that the runner is paired before it accepts anything", () => {
    render(<HomelabClient />);
    expect(screen.getByText(/einmaligen Pairing-Code/)).toBeInTheDocument();
    expect(screen.getByText(/erst dann nimmt er Pläne an/)).toBeInTheDocument();
  });

  it("says installing stays a decision made on the machine", () => {
    render(<HomelabClient />);
    expect(screen.getByText(/--allow-install/)).toBeInTheDocument();
  });
});
