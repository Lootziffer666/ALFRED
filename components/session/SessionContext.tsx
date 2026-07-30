"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { AcceptanceReport, ContractFinding, ContractMap, Handoff, RepoEvidence, SessionExport } from "@/lib/schema";
import { auditChange, generateContractMap, inspectRepo } from "@/lib/client/api";
import { buildHandoffDraft } from "@/lib/handoff";
import {
  demoAcceptanceReport,
  demoAgentSummary,
  demoContractMap,
  demoDiffText,
  demoHandoff,
  demoRepoEvidence,
} from "@/lib/demo/fixtures";

export type Step = "setup" | "inventory" | "contract" | "handoff" | "audit";

export const STEPS: { id: Step; label: string }[] = [
  { id: "setup", label: "Session setup" },
  { id: "inventory", label: "Inventory" },
  { id: "contract", label: "Contract map" },
  { id: "handoff", label: "Handoff" },
  { id: "audit", label: "Result audit" },
];

interface SessionState {
  step: Step;
  setStep: (s: Step) => void;

  demoMode: boolean;
  setDemoMode: (v: boolean) => void;

  repoInput: string;
  setRepoInput: (v: string) => void;
  refInput: string;
  setRefInput: (v: string) => void;
  githubToken: string;
  setGithubToken: (v: string) => void;
  openRouterKey: string;
  setOpenRouterKey: (v: string) => void;
  openRouterModel: string;
  setOpenRouterModel: (v: string) => void;

  inventory: RepoEvidence | null;
  inventoryLoading: boolean;
  inventoryError: string | null;
  runInspect: () => Promise<void>;

  contractMap: ContractMap | null;
  contractLoading: boolean;
  contractError: string | null;
  runContractMap: () => Promise<void>;

  selectedFindingIds: Set<string>;
  toggleFinding: (id: string) => void;

  objective: string;
  setObjective: (v: string) => void;
  handoff: Handoff | null;
  buildHandoff: () => void;
  updateHandoff: (patch: Partial<Handoff>) => void;

  auditUrl: string;
  setAuditUrl: (v: string) => void;
  auditDiff: string;
  setAuditDiff: (v: string) => void;
  agentSummary: string;
  setAgentSummary: (v: string) => void;
  auditReport: AcceptanceReport | null;
  auditLoading: boolean;
  auditError: string | null;
  runAudit: (mode: "url" | "diff") => Promise<void>;

  reset: () => void;
  buildExport: () => SessionExport;
}

const SessionCtx = createContext<SessionState | null>(null);

export function useSession(): SessionState {
  const ctx = useContext(SessionCtx);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [step, setStep] = useState<Step>("setup");
  const [demoMode, setDemoModeState] = useState(false);

  const [repoInput, setRepoInput] = useState("");
  const [refInput, setRefInput] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [openRouterModel, setOpenRouterModel] = useState("");

  const [inventory, setInventory] = useState<RepoEvidence | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  const [contractMap, setContractMap] = useState<ContractMap | null>(null);
  const [contractLoading, setContractLoading] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);

  const [selectedFindingIds, setSelectedFindingIds] = useState<Set<string>>(new Set());

  const [objective, setObjective] = useState("");
  const [handoff, setHandoff] = useState<Handoff | null>(null);

  const [auditUrl, setAuditUrl] = useState("");
  const [auditDiff, setAuditDiff] = useState("");
  const [agentSummary, setAgentSummary] = useState("");
  const [auditReport, setAuditReport] = useState<AcceptanceReport | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const setDemoMode = useCallback((v: boolean) => {
    setDemoModeState(v);
    if (v) {
      setInventory(demoRepoEvidence);
      setContractMap(demoContractMap);
      setSelectedFindingIds(new Set(demoContractMap.findings.map((f) => f.id)));
      setHandoff(demoHandoff);
      setObjective(demoHandoff.objective);
      setAuditDiff(demoDiffText);
      setAgentSummary(demoAgentSummary);
      setAuditReport(demoAcceptanceReport);
      setRepoInput(`${demoRepoEvidence.identity.owner}/${demoRepoEvidence.identity.name}`);
    }
  }, []);

  const runInspect = useCallback(async () => {
    setInventoryError(null);
    setInventoryLoading(true);
    setContractMap(null);
    setHandoff(null);
    setAuditReport(null);
    try {
      const result = await inspectRepo({ repo: repoInput, ref: refInput || undefined, token: githubToken || undefined });
      if (!result.ok) {
        setInventoryError(result.error);
        return;
      }
      setInventory(result.data.evidence);
      setStep("inventory");
    } finally {
      setInventoryLoading(false);
    }
  }, [repoInput, refInput, githubToken]);

  const runContractMap = useCallback(async () => {
    if (!inventory) return;
    setContractError(null);
    setContractLoading(true);
    try {
      const result = await generateContractMap({ evidence: inventory, apiKey: openRouterKey, model: openRouterModel });
      if (!result.ok) {
        setContractError(result.error);
        return;
      }
      setContractMap(result.data.contractMap);
      setSelectedFindingIds(new Set());
      setStep("contract");
    } finally {
      setContractLoading(false);
    }
  }, [inventory, openRouterKey, openRouterModel]);

  const toggleFinding = useCallback((id: string) => {
    setSelectedFindingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const buildHandoffCb = useCallback(() => {
    if (!inventory || !contractMap) return;
    const selected: ContractFinding[] = contractMap.findings.filter((f) => selectedFindingIds.has(f.id));
    const draft = buildHandoffDraft({ evidence: inventory, selectedFindings: selected, objective });
    setHandoff(draft);
    setStep("handoff");
  }, [inventory, contractMap, selectedFindingIds, objective]);

  const updateHandoff = useCallback((patch: Partial<Handoff>) => {
    setHandoff((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const runAudit = useCallback(
    async (mode: "url" | "diff") => {
      if (!handoff) return;
      setAuditError(null);
      setAuditLoading(true);
      try {
        const result = await auditChange({
          handoff,
          input: mode === "url" ? { kind: "url", url: auditUrl } : { kind: "pasted_diff", diff: auditDiff },
          token: githubToken || undefined,
          agentSummary: agentSummary || undefined,
        });
        if (!result.ok) {
          setAuditError(result.error);
          return;
        }
        setAuditReport(result.data.report);
      } finally {
        setAuditLoading(false);
      }
    },
    [handoff, auditUrl, auditDiff, githubToken, agentSummary],
  );

  const reset = useCallback(() => {
    setStep("setup");
    setDemoModeState(false);
    setRepoInput("");
    setRefInput("");
    setInventory(null);
    setInventoryError(null);
    setContractMap(null);
    setContractError(null);
    setSelectedFindingIds(new Set());
    setObjective("");
    setHandoff(null);
    setAuditUrl("");
    setAuditDiff("");
    setAgentSummary("");
    setAuditReport(null);
    setAuditError(null);
  }, []);

  const buildExport = useCallback((): SessionExport => {
    return {
      exportedAt: new Date().toISOString(),
      repo: inventory
        ? { owner: inventory.identity.owner, name: inventory.identity.name, ref: inventory.identity.ref, url: inventory.identity.url }
        : { owner: "", name: "", ref: "", url: "https://github.com" },
      inventory,
      contractMap,
      handoff,
      acceptanceReport: auditReport,
      warnings: inventory?.warnings ?? [],
      modelsUsed: contractMap ? [{ purpose: "contract-map", modelId: contractMap.modelId }] : [],
    };
  }, [inventory, contractMap, handoff, auditReport]);

  const value = useMemo<SessionState>(
    () => ({
      step,
      setStep,
      demoMode,
      setDemoMode,
      repoInput,
      setRepoInput,
      refInput,
      setRefInput,
      githubToken,
      setGithubToken,
      openRouterKey,
      setOpenRouterKey,
      openRouterModel,
      setOpenRouterModel,
      inventory,
      inventoryLoading,
      inventoryError,
      runInspect,
      contractMap,
      contractLoading,
      contractError,
      runContractMap,
      selectedFindingIds,
      toggleFinding,
      objective,
      setObjective,
      handoff,
      buildHandoff: buildHandoffCb,
      updateHandoff,
      auditUrl,
      setAuditUrl,
      auditDiff,
      setAuditDiff,
      agentSummary,
      setAgentSummary,
      auditReport,
      auditLoading,
      auditError,
      runAudit,
      reset,
      buildExport,
    }),
    [
      step,
      demoMode,
      setDemoMode,
      repoInput,
      refInput,
      githubToken,
      openRouterKey,
      openRouterModel,
      inventory,
      inventoryLoading,
      inventoryError,
      runInspect,
      contractMap,
      contractLoading,
      contractError,
      runContractMap,
      selectedFindingIds,
      toggleFinding,
      objective,
      handoff,
      buildHandoffCb,
      updateHandoff,
      auditUrl,
      auditDiff,
      agentSummary,
      auditReport,
      auditLoading,
      auditError,
      runAudit,
      reset,
      buildExport,
    ],
  );

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}
