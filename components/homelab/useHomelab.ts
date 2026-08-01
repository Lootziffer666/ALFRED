"use client";

import { useCallback, useMemo, useState } from "react";
import { searchModelCandidates } from "@/lib/client/api";
import { confirmDiscovery, reconcileHardware } from "@/lib/homelab/discovery";
import { FIXTURE_MODELS, FIXTURE_NODES, FIXTURE_RECORDS, TASK_PROFILES, taskProfile } from "@/lib/homelab/fixtures";
import { planPlacements, type PlannerNode, type PlanningResult } from "@/lib/homelab/planner";
import { nodeObservationSchema } from "@/lib/schema/homelab";
import { importCorpus } from "@/lib/corpus/snapshot";
import { deriveNeeds } from "@/lib/corpus/needs";
import type {
  ModelCandidate,
  ModelCapabilityRecord,
  NodeDeclaration,
  NodeDiscovery,
  NodeObservation,
  NodePolicy,
  TaskProfileId,
} from "@/lib/schema/homelab";
import type { Need } from "@/lib/schema/corpus";

/**
 * State for Raum IX (plan §22.2). Everything here is offline: the only network
 * call is the model catalogue search. Nothing is prepared, activated or
 * executed at this stage — that starts with the runner.
 */

export const HOMELAB_STEPS = [
  { id: "devices", label: "Geräte finden" },
  { id: "hardware", label: "Hardware prüfen" },
  { id: "policies", label: "Nutzungsregeln" },
  { id: "needs", label: "Bedarf" },
  { id: "models", label: "Modelle" },
  { id: "plan", label: "Plan" },
  { id: "export", label: "Export" },
] as const;

export type HomelabStep = (typeof HOMELAB_STEPS)[number]["id"];

export interface ManualNodeInput {
  name: string;
  kind: NodeDeclaration["kind"];
  os: NodeDeclaration["os"];
  trust: NodeDeclaration["trust"];
  availability: NodeDeclaration["availability"];
  cpu?: string;
  ramGb?: number;
  vramGb?: number;
}

export interface PendingDiscovery {
  discovery: NodeDiscovery;
  /** Why this cannot become a node yet. */
  blocked: string;
}

const DEFAULT_POLICY: NodePolicy = {
  automaticUse: false,
  mayInstall: false,
  maxDataClass: "public",
  computeWhileUserActive: false,
  quietHours: [],
  allowedTasks: [],
};

function nowIso() {
  return new Date().toISOString();
}

export function useHomelab() {
  const [step, setStep] = useState<HomelabStep>("devices");
  const [nodes, setNodes] = useState<PlannerNode[]>([]);
  const [pending, setPending] = useState<PendingDiscovery[]>([]);
  const [tasks, setTasks] = useState<TaskProfileId[]>([]);
  const [models, setModels] = useState<ModelCandidate[]>([...FIXTURE_MODELS]);
  const [records] = useState<ModelCapabilityRecord[]>([...FIXTURE_RECORDS]);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [notices, setNotices] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);

  const note = useCallback((message: string) => {
    setNotices((current) => [message, ...current].slice(0, 6));
  }, []);

  const loadFixtures = useCallback(() => {
    setNodes((current) => {
      const known = new Set(current.map((n) => n.declaration.id));
      const added = FIXTURE_NODES.filter((n) => !known.has(n.id)).map((declaration) => ({ declaration }));
      return [...current, ...added];
    });
  }, []);

  const addManualNode = useCallback((input: ManualNodeInput) => {
    const id = `manual-${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`;
    const at = nowIso();
    const declaration = confirmDiscovery(
      {
        discoveredId: id,
        source: "manual-declaration",
        firstSeenAt: at,
        lastSeenAt: at,
        pairingStatus: "discovered",
        suggestedName: input.name,
      },
      {
        id,
        name: input.name,
        kind: input.kind,
        os: input.os,
        trust: input.trust,
        availability: input.availability,
        declared: {
          cpu: input.cpu,
          ramGb: input.ramGb,
          gpus: input.vramGb
            ? [{ vendor: "nvidia", model: "unbenannt", vramGb: input.vramGb, drivesDisplay: false }]
            : [],
        },
        policy: DEFAULT_POLICY,
        createdAt: at,
      },
    );
    setNodes((current) => [...current, { declaration }]);
  }, []);

  /**
   * A runner that announced itself cannot become a node here: pairing is the
   * runner stage. The address is remembered and the reason is stated.
   */
  const rememberRunnerAddress = useCallback(
    (address: string) => {
      const at = nowIso();
      setPending((current) => [
        ...current,
        {
          discovery: {
            discoveredId: `manual-address:${address}`,
            source: "manual-address",
            address,
            firstSeenAt: at,
            lastSeenAt: at,
            pairingStatus: "pairing-required",
          },
          blocked: "Pairing steht aus — ohne bestätigten Fingerprint entsteht kein Node.",
        },
      ]);
      note(`${address} vorgemerkt. Gepairt wird erst mit dem Runner.`);
    },
    [note],
  );

  const removeNode = useCallback((id: string) => {
    setNodes((current) => current.filter((n) => n.declaration.id !== id));
  }, []);

  const setPolicy = useCallback((id: string, policy: NodePolicy) => {
    setNodes((current) =>
      current.map((n) => (n.declaration.id === id ? { ...n, declaration: { ...n.declaration, policy } } : n)),
    );
  }, []);

  /** Accepts a runner's probe output as JSON, validated before it is trusted. */
  const importObservation = useCallback(
    (raw: string): boolean => {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(raw);
      } catch (err) {
        note(`Beobachtung ist kein gültiges JSON: ${(err as Error).message}`);
        return false;
      }
      const parsed = nodeObservationSchema.safeParse(parsedJson);
      if (!parsed.success) {
        note("Beobachtung entspricht nicht dem NodeObservation-Schema.");
        return false;
      }
      const observation: NodeObservation = parsed.data;
      if (!nodes.some((n) => n.declaration.id === observation.nodeId)) {
        note(`Kein Node mit der ID „${observation.nodeId}".`);
        return false;
      }
      setNodes((current) =>
        current.map((n) => (n.declaration.id === observation.nodeId ? { ...n, observation } : n)),
      );
      note(`Beobachtung für ${observation.nodeId} übernommen.`);
      return true;
    },
    [nodes, note],
  );

  /** Reads an Etappe-2 corpus export; only the project corpus produces needs. */
  const importProjectCorpus = useCallback(
    (raw: string): boolean => {
      try {
        const corpus = importCorpus(raw);
        const derived = deriveNeeds(corpus.project);
        setNeeds(derived);
        note(
          `${corpus.project.length} Projekt-Repositories gelesen, ${derived.length} offene Punkte. ` +
            `Donor (${corpus.donor.length}) und extern (${corpus.external.length}) erzeugen keinen Bedarf.`,
        );
        return true;
      } catch (err) {
        note((err as Error).message);
        return false;
      }
    },
    [note],
  );

  const toggleTask = useCallback((id: TaskProfileId) => {
    setTasks((current) => (current.includes(id) ? current.filter((t) => t !== id) : [...current, id]));
  }, []);

  const searchModels = useCallback(
    async (query: string) => {
      setSearching(true);
      const result = await searchModelCandidates({ query, limit: 3 });
      setSearching(false);
      if (!result.ok) {
        note(result.error);
        return;
      }
      setModels((current) => {
        const known = new Set(current.map((m) => m.id));
        return [...current, ...result.data.candidates.filter((c) => !known.has(c.id))];
      });
      note(
        `${result.data.candidates.length} Kandidaten übernommen` +
          (result.data.skipped.length ? `, ${result.data.skipped.length} übersprungen.` : "."),
      );
    },
    [note],
  );

  const reconciliation = useMemo(
    () => nodes.map((n) => ({ node: n.declaration, rows: reconcileHardware(n.declaration, n.observation) })),
    [nodes],
  );

  const planning: PlanningResult = useMemo(
    () =>
      planPlacements({
        tasks: tasks.map(taskProfile),
        nodes,
        models,
        records,
      }),
    [tasks, nodes, models, records],
  );

  return {
    step,
    setStep,
    nodes,
    pending,
    tasks,
    models,
    records,
    needs,
    notices,
    searching,
    reconciliation,
    planning,
    allTasks: TASK_PROFILES,
    loadFixtures,
    addManualNode,
    rememberRunnerAddress,
    removeNode,
    setPolicy,
    importObservation,
    importProjectCorpus,
    toggleTask,
    searchModels,
  };
}
