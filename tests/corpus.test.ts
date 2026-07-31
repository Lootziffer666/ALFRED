import { describe, it, expect } from "vitest";
import { evidenceRefSchema, detailedEvidenceRefSchema } from "@/lib/schema/common";
import { isOpen, isProven, staleIfMoved, truthStatusSchema } from "@/lib/schema/truth";
import {
  CORPUS_SNAPSHOT_VERSION,
  type DonorEntry,
  type ExternalEntry,
  type ProjectEntry,
} from "@/lib/schema/corpus";
import { deriveNeeds, deriveSuggestions, refreshTruth } from "@/lib/corpus/needs";
import { EvidenceStore } from "@/lib/corpus/store";
import { ProjectGraph } from "@/lib/corpus/graph";
import { DecisionLedger } from "@/lib/corpus/ledger";
import {
  SnapshotVersionError,
  createCorpus,
  danglingEvidenceIds,
  exportCorpus,
  importCorpus,
} from "@/lib/corpus/snapshot";

const AT = "2026-07-31T00:00:00.000Z";
const REPO = { owner: "Lootziffer666", name: "SHADED", ref: "main" };

const project: ProjectEntry = {
  corpus: "project",
  repo: REPO,
  addedAt: AT,
  observedAtCommit: "abc123",
  capabilities: [
    { id: "blender-export", label: "Blender-Export", truth: "declared", evidenceIds: ["ev-readme"] },
    { id: "scene-isolation", label: "Szenen-Isolation", truth: "verified", evidenceIds: ["ev-test"] },
    { id: "undo", label: "Undo", truth: "not_proven", evidenceIds: [] },
  ],
};

const donor: DonorEntry = {
  corpus: "donor",
  repo: { owner: "octo", name: "graph-editor" },
  addedAt: AT,
  origin: "star",
  capabilities: [{ id: "node-editor", label: "Node-Editor", truth: "declared", evidenceIds: [] }],
};

const external: ExternalEntry = {
  corpus: "external",
  repo: { owner: "stranger", name: "flowlib" },
  addedAt: AT,
  assessment: "unverified",
  capabilities: [{ id: "node-editor", label: "Node-Editor", truth: "declared", evidenceIds: [] }],
};

describe("truth status", () => {
  it("is a vocabulary of its own, separate from fetch status", () => {
    expect(truthStatusSchema.options).toEqual([
      "declared",
      "observed",
      "verified",
      "not_proven",
      "contradicted",
      "stale",
    ]);
  });

  it("treats only a checked result as proven", () => {
    expect(isProven("verified")).toBe(true);
    for (const s of ["declared", "observed", "not_proven", "contradicted", "stale"] as const) {
      expect(isProven(s), `${s} must not count as proven`).toBe(false);
    }
  });

  it("counts anything unsettled as an open question", () => {
    expect((["declared", "not_proven", "stale", "contradicted"] as const).every(isOpen)).toBe(true);
    expect(isOpen("verified")).toBe(false);
    expect(isOpen("observed")).toBe(false);
  });

  it("goes stale when the repository moved past the commit it was read at", () => {
    expect(staleIfMoved("verified", "abc123", "def456")).toBe("stale");
    expect(staleIfMoved("observed", "abc123", "def456")).toBe("stale");
    expect(staleIfMoved("verified", "abc123", "abc123")).toBe("verified");
    // Age does not turn an unsupported claim into a different kind of problem.
    expect(staleIfMoved("not_proven", "abc123", "def456")).toBe("not_proven");
    expect(staleIfMoved("contradicted", "abc123", "def456")).toBe("contradicted");
  });
});

describe("evidence schema stays backwards compatible", () => {
  it("still accepts the small reference used everywhere today", () => {
    const small = { source: "package.json · scripts.build" };
    expect(evidenceRefSchema.parse(small)).toEqual(small);
    expect(detailedEvidenceRefSchema.parse(small)).toEqual(small);
  });

  it("adds the detailed fields without making any of them required", () => {
    const detailed = detailedEvidenceRefSchema.parse({
      source: "lib/export.ts · sceneToGltf",
      repository: "Lootziffer666/SHADED",
      commitSha: "abc123",
      path: "lib/export.ts",
      symbol: "sceneToGltf",
      lineStart: 12,
      lineEnd: 48,
      artifactHash: "sha256:beef",
      observedAt: AT,
    });
    expect(detailed.symbol).toBe("sceneToGltf");
    expect(detailedEvidenceRefSchema.safeParse({ source: "x", lineStart: 0 }).success).toBe(false);
  });
});

describe("corpus separation", () => {
  it("derives binding needs from the project corpus only", () => {
    const needs = deriveNeeds([project]);
    expect(needs.map((n) => n.capabilityId)).toEqual(["blender-export", "undo"]);
    expect(needs.every((n) => n.repo.name === "SHADED")).toBe(true);
    expect(needs[0].reason).toMatch(/Nur behauptet/);
  });

  it("refuses donor and external entries at the type level", () => {
    // @ts-expect-error donor material can never become a binding need
    deriveNeeds([donor]);
    // @ts-expect-error external finds can never become a binding need
    deriveNeeds([external]);
  });

  it("turns donor and external material into suggestions and nothing stronger", () => {
    const suggestions = deriveSuggestions([donor, external]);
    expect(suggestions.map((s) => s.corpus)).toEqual(["donor", "external"]);
    expect(suggestions[1].note).toMatch(/unbestätigt/);
    // A suggestion has no truth status to promote — it is not a claim about the project.
    expect(suggestions[0]).not.toHaveProperty("truth");
  });

  it("says nothing is needed when everything is verified", () => {
    const settled: ProjectEntry = {
      ...project,
      capabilities: [{ id: "x", label: "X", truth: "verified", evidenceIds: [] }],
    };
    expect(deriveNeeds([settled])).toEqual([]);
  });

  it("re-opens verified capabilities once the repository has moved on", () => {
    const refreshed = refreshTruth(project, "def456");
    expect(refreshed.capabilities.map((c) => c.truth)).toEqual(["declared", "stale", "not_proven"]);
    expect(deriveNeeds([refreshed]).map((n) => n.capabilityId)).toEqual([
      "blender-export",
      "scene-isolation",
      "undo",
    ]);
  });
});

describe("evidence store", () => {
  it("resolves what it holds and names what it does not", () => {
    const store = new EvidenceStore();
    store.record({
      id: "ev-1",
      kind: "commit",
      ref: { source: "commit abc123", repository: "Lootziffer666/SHADED", commitSha: "abc123" },
      recordedAt: AT,
    });

    expect(store.size).toBe(1);
    expect(store.resolve(["ev-1", "ev-missing"]).map((r) => r.id)).toEqual(["ev-1"]);
    expect(store.missing(["ev-1", "ev-missing"])).toEqual(["ev-missing"]);
    expect(store.forRepository("Lootziffer666/SHADED")).toHaveLength(1);
    expect(store.forRepository("someone/else")).toEqual([]);
  });
});

describe("project graph", () => {
  const graph = new ProjectGraph();
  graph.addNode({ id: "shaded", kind: "product", label: "SHADED", corpus: "project", truth: "verified", evidenceIds: [] });
  graph.addNode({ id: "export", kind: "capability", label: "Export", corpus: "project", truth: "declared", evidenceIds: [] });
  graph.addNode({ id: "flowlib", kind: "donor-candidate", label: "flowlib", corpus: "external", truth: "not_proven", evidenceIds: [] });
  graph.addEdge({ from: "shaded", to: "export", kind: "provides" });
  graph.addEdge({ from: "flowlib", to: "export", kind: "candidate-for" });

  it("refuses an edge to a node that does not exist", () => {
    expect(() => graph.addEdge({ from: "shaded", to: "ghost", kind: "requires" })).toThrow(/Unknown graph node/);
  });

  it("keeps external candidates out of the proven project set", () => {
    expect(graph.provenProjectNodes().map((n) => n.id)).toEqual(["shaded"]);
    expect(graph.nodes({ corpus: "external" }).map((n) => n.id)).toEqual(["flowlib"]);
  });

  it("answers what points at a capability", () => {
    expect(graph.edges({ to: "export" }).map((e) => e.kind)).toEqual(["provides", "candidate-for"]);
    expect(graph.neighbours("shaded", "provides").map((n) => n.id)).toEqual(["export"]);
  });
});

describe("decision ledger", () => {
  const older = {
    id: "d-1",
    statement: "Der Repo-Auditor darf nichts installieren.",
    rationale: "Damaliger Scope: reines Lesen.",
    scope: "alfret/deployment",
    status: "active" as const,
    rejectedAlternatives: [],
    evidenceIds: [],
    supersedes: [],
    decidedAt: "2025-01-01T00:00:00.000Z",
  };
  const newer = {
    ...older,
    id: "d-2",
    statement: "ALFRET darf Runner, Modelle und Toolchains vorbereiten.",
    rationale: "Heutiger Scope umfasst Arbeitsumgebungen, keine Produktdeployments.",
    supersedes: ["d-1"],
    decidedAt: "2026-07-31T00:00:00.000Z",
  };

  it("lets a current decision retire a historical one", () => {
    const ledger = new DecisionLedger([older]);
    ledger.record(newer);

    expect(ledger.get("d-1")!.status).toBe("superseded");
    expect(ledger.resolve("alfret/deployment")!.id).toBe("d-2");
    expect(ledger.active("alfret/deployment").map((d) => d.id)).toEqual(["d-2"]);
  });

  it("never lets a superseded rule win, whatever its date", () => {
    const ledger = new DecisionLedger([older]);
    ledger.record({ ...newer, decidedAt: "2020-01-01T00:00:00.000Z" });
    expect(ledger.resolve("alfret/deployment")!.id).toBe("d-2");
  });

  it("keeps the retired decision readable as history", () => {
    const ledger = new DecisionLedger([older]);
    ledger.record(newer);
    expect(ledger.history("alfret/deployment").map((d) => d.id)).toEqual(["d-1", "d-2"]);
  });

  it("refuses to supersede a decision it has never seen", () => {
    const ledger = new DecisionLedger();
    expect(() => ledger.record(newer)).toThrow(/Cannot supersede unknown decision/);
  });

  it("returns nothing for a scope that was never decided", () => {
    expect(new DecisionLedger([older]).resolve("alfret/colours")).toBeNull();
  });
});

describe("snapshot", () => {
  function populated() {
    const corpus = createCorpus();
    corpus.project.push(project);
    corpus.donor.push(donor);
    corpus.external.push(external);
    corpus.evidence.record({
      id: "ev-readme",
      kind: "file",
      ref: { source: "README.md", repository: "Lootziffer666/SHADED", path: "README.md" },
      recordedAt: AT,
    });
    corpus.graph.addNode({
      id: "shaded",
      kind: "product",
      label: "SHADED",
      corpus: "project",
      truth: "observed",
      evidenceIds: ["ev-readme"],
    });
    return corpus;
  }

  it("round-trips through JSON without losing a corpus boundary", () => {
    const restored = importCorpus(exportCorpus(populated(), AT));

    expect(restored.project).toHaveLength(1);
    expect(restored.donor[0].corpus).toBe("donor");
    expect(restored.external[0].assessment).toBe("unverified");
    expect(restored.evidence.get("ev-readme")!.ref.path).toBe("README.md");
    expect(restored.graph.node("shaded")!.truth).toBe("observed");
    expect(deriveNeeds(restored.project).map((n) => n.capabilityId)).toEqual(["blender-export", "undo"]);
  });

  it("refuses a snapshot from a version it cannot read, instead of half-reading it", () => {
    expect(() => importCorpus(JSON.stringify({ version: 99, exportedAt: AT }))).toThrow(SnapshotVersionError);
    expect(() => importCorpus('{"nope"')).toThrow(/not valid JSON/);
    expect(() => importCorpus(JSON.stringify({ version: CORPUS_SNAPSHOT_VERSION, project: "no" }))).toThrow(
      /malformed/,
    );
  });

  it("names claims that point at evidence nobody recorded", () => {
    const corpus = populated();
    expect(danglingEvidenceIds(corpus)).toEqual(["ev-test"]);
  });
});
