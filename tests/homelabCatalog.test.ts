import { describe, it, expect } from "vitest";
import {
  architectureFrom,
  candidatesFrom,
  classifyLicense,
  quantizationLabel,
  type HfModel,
} from "@/lib/homelab/huggingface";
import { buildSearchQuery, scoreCandidate, type ScoutQuery } from "@/lib/homelab/scout";
import type { RepoSearchHit } from "@/lib/github";
import {
  BenchmarkHistory,
  BenchmarkVersionError,
  importBenchmarkHistory,
} from "@/lib/homelab/benchmarks";
import { bestModel, rankModels } from "@/lib/homelab/models";
import { taskProfile } from "@/lib/homelab/fixtures";
import type { ModelCapabilityRecord } from "@/lib/schema/homelab";

const NOW = new Date("2026-07-31T00:00:00.000Z");

/** Shaped exactly like the live response, so the mapping is tested against reality. */
const HF_MODEL: HfModel = {
  id: "bartowski/Qwen2.5-Coder-7B-Instruct-GGUF",
  sha: "1f629da0c8bed16b9e50cee91c70693650e66c35",
  gated: false,
  tags: ["transformers", "gguf", "license:apache-2.0"],
  cardData: { license: "apache-2.0" },
  gguf: { total: 7615616512, architecture: "qwen2", context_length: 32768 },
  siblings: [
    { rfilename: "README.md" },
    {
      rfilename: "Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf",
      size: 4683073248,
      lfs: { sha256: "aaaabbbb" },
    },
    { rfilename: "Qwen2.5-Coder-7B-Instruct-IQ2_M.gguf", size: 2780343072 },
    // Split archives cannot be loaded as one file.
    { rfilename: "Qwen2.5-Coder-7B-Instruct-Q8_0-00001-of-00003.gguf", size: 5000000000 },
    // No size means no estimate, so no candidate.
    { rfilename: "Qwen2.5-Coder-7B-Instruct-Q6_K.gguf" },
  ],
};

describe("Hugging Face adapter", () => {
  it("classifies licences by what may actually be done with them", () => {
    expect(classifyLicense("apache-2.0")).toBe("permissive");
    expect(classifyLicense("MIT")).toBe("permissive");
    expect(classifyLicense("gpl-3.0")).toBe("copyleft");
    expect(classifyLicense("cc-by-sa-4.0")).toBe("copyleft");
    expect(classifyLicense("cc-by-nc-4.0")).toBe("restricted");
    expect(classifyLicense("llama3.1")).toBe("restricted");
    expect(classifyLicense("other")).toBe("restricted");
    expect(classifyLicense(undefined)).toBe("unknown");
    expect(classifyLicense("")).toBe("unknown");
  });

  it("reads the quantisation out of the file name", () => {
    expect(quantizationLabel("Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf")).toBe("Q4_K_M");
    expect(quantizationLabel("model-IQ2_M.gguf")).toBe("IQ2_M");
    expect(quantizationLabel("model-f16.gguf")).toBe("F16");
    expect(quantizationLabel("model.safetensors")).toBeUndefined();
  });

  it("builds one candidate per loadable quantisation, and skips the rest", () => {
    const candidates = candidatesFrom(HF_MODEL);
    expect(candidates.map((c) => c.quantization)).toEqual(["Q4_K_M", "IQ2_M"]);
  });

  it("takes size, parameters and context from the repository instead of estimating them", () => {
    const [q4] = candidatesFrom(HF_MODEL);
    expect(q4.fileSizeGb).toBeCloseTo(4.683, 3);
    expect(q4.paramsB).toBeCloseTo(7.62, 2);
    expect(q4.contextLength).toBe(32768);
    // Real bits per weight, computed from the real file and the real count.
    expect(q4.quantBits).toBeCloseTo(4.92, 1);
  });

  it("leaves the layer shape undefined rather than inventing it", () => {
    const [q4] = candidatesFrom(HF_MODEL);
    expect(q4.layers).toBeUndefined();
    expect(q4.kvDim).toBeUndefined();
  });

  it("reads grouped-query attention out of config.json instead of assuming full width", () => {
    // Qwen2.5-Coder-7B, verbatim from its own config.json.
    const architecture = architectureFrom({
      num_hidden_layers: 28,
      hidden_size: 3584,
      num_attention_heads: 28,
      num_key_value_heads: 4,
    })!;

    expect(architecture.layers).toBe(28);
    expect(architecture.hiddenSize).toBe(3584);
    // 4 KV heads × 128 per head — seven times narrower than the hidden state.
    expect(architecture.kvDim).toBe(512);
  });

  it("treats a model without a KV head count as full multi-head attention", () => {
    const architecture = architectureFrom({
      num_hidden_layers: 32,
      hidden_size: 4096,
      num_attention_heads: 32,
    })!;
    expect(architecture.kvDim).toBe(4096);
  });

  it("returns nothing rather than a partial shape", () => {
    expect(architectureFrom({ hidden_size: 4096 })).toBeNull();
    expect(architectureFrom({})).toBeNull();
  });

  it("carries the measured shape onto every candidate of the repository", () => {
    const candidates = candidatesFrom(HF_MODEL, { layers: 28, hiddenSize: 3584, kvDim: 512 });
    expect(candidates.every((c) => c.kvDim === 512 && c.layers === 28)).toBe(true);
  });

  it("carries the file's own hash and URL as evidence", () => {
    const [q4] = candidatesFrom(HF_MODEL);
    expect(q4.evidence[0].artifactHash).toBe("sha256:aaaabbbb");
    expect(q4.evidence[0].url).toContain("Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf");
    expect(q4.evidence[0].commitSha).toBe(HF_MODEL.sha);
  });

  it("still lists a gated repository, so the planner can say why it refuses it", () => {
    const gated = candidatesFrom({ ...HF_MODEL, gated: "auto", cardData: { license: "llama3.1" } });
    expect(gated[0].gated).toBe(true);
    expect(gated[0].license).toBe("restricted");

    const ranked = rankModels(gated, {
      task: taskProfile("typescript.patch"),
      runtime: "ollama",
      target: "gpu",
      availableGb: 80,
      records: [],
    });
    expect(ranked[0].blockers.join(" ")).toMatch(/gated/);
    expect(bestModel(ranked)).toBeNull();
  });
});

describe("scout", () => {
  const query: ScoutQuery = {
    need: { capabilityId: "node-editor", label: "graph node editor" },
    stack: ["TypeScript", "JavaScript"],
    licenseRequirement: "permissive",
  };

  const hit = (overrides: Partial<RepoSearchHit> = {}): RepoSearchHit => ({
    fullName: "octo/graph-node-editor",
    description: "A graph node editor with undo",
    url: "https://github.com/octo/graph-node-editor",
    stars: 1200,
    language: "TypeScript",
    license: "MIT",
    pushedAt: "2026-07-01T00:00:00.000Z",
    openIssues: 12,
    topics: ["graph", "editor"],
    sizeKb: 1500,
    archived: false,
    fork: false,
    ...overrides,
  });

  it("searches by the need and the project's own stack, excluding dead repositories", () => {
    const search = buildSearchQuery(query);
    expect(search).toContain("graph node editor");
    expect(search).toContain("language:TypeScript");
    expect(search).toContain("archived:false");
  });

  it("rates a healthy, permissive, on-stack repository highly", () => {
    const score = scoreCandidate(hit(), query, NOW);
    expect(score.total).toBeGreaterThan(0.7);
    expect(score.license).toBe(1);
    expect(score.stackProximity).toBe(1);
    expect(score.blockers).toEqual([]);
  });

  it("blocks adoption when the licence is unclear, and offers reading it instead", () => {
    const score = scoreCandidate(hit({ license: null }), query, NOW);
    expect(score.license).toBe(0);
    expect(score.blockers.join(" ")).toMatch(/Lizenz unklar/);
    expect(score.role).toBe("reference");
  });

  it("blocks copyleft when the project asked for permissive", () => {
    const score = scoreCandidate(hit({ license: "GPL-3.0" }), query, NOW);
    expect(score.blockers.join(" ")).toMatch(/Copyleft/);
    expect(scoreCandidate(hit({ license: "GPL-3.0" }), { ...query, licenseRequirement: "any-open" }, NOW).blockers)
      .toEqual([]);
  });

  it("marks an archived repository as unmaintained and blocked", () => {
    const score = scoreCandidate(hit({ archived: true }), query, NOW);
    expect(score.maintenance).toBe(0);
    expect(score.blockers.join(" ")).toMatch(/Archiviert/);
  });

  it("does not claim to know the test situation", () => {
    const score = scoreCandidate(hit(), query, NOW);
    expect(score.tests).toBe(0);
    expect(score.notes.join(" ")).toMatch(/Testlage nicht geprüft/);
  });

  it("degrades the score as a repository goes quiet", () => {
    const fresh = scoreCandidate(hit({ pushedAt: "2026-07-01T00:00:00.000Z" }), query, NOW);
    const stale = scoreCandidate(hit({ pushedAt: "2023-01-01T00:00:00.000Z" }), query, NOW);
    expect(fresh.maintenance).toBeGreaterThan(stale.maintenance);
    expect(stale.notes.join(" ")).toMatch(/still/);
  });

  it("proposes a fork base rather than a dependency when nobody maintains it", () => {
    const score = scoreCandidate(hit({ pushedAt: "2021-01-01T00:00:00.000Z" }), query, NOW);
    expect(score.role).toBe("fork-base");
  });
});

describe("benchmark history", () => {
  const record = (overrides: Partial<ModelCapabilityRecord> = {}): ModelCapabilityRecord => ({
    modelId: "mid-8b-q4",
    task: "repository.reasoning",
    quality: 0.8,
    schemaFidelity: 0.9,
    scopeFidelity: 0.85,
    errorRate: 0.1,
    refineryRework: 0.2,
    runtimeSeconds: 40,
    source: "real-run",
    observedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  });

  it("averages measured runs and ignores published numbers when both exist", () => {
    const history = new BenchmarkHistory([
      record({ quality: 0.8 }),
      record({ quality: 0.7, observedAt: "2026-07-15T00:00:00.000Z" }),
      record({ quality: 0.99, source: "published", observedAt: "2026-07-20T00:00:00.000Z" }),
    ]);

    const summary = history.summarise("mid-8b-q4", "repository.reasoning")!;
    expect(summary.runs).toBe(3);
    expect(summary.measuredRuns).toBe(2);
    expect(summary.quality).toBeCloseTo(0.75, 5);
    expect(summary.measured).toBe(true);
    expect(summary.lastObservedAt).toBe("2026-07-20T00:00:00.000Z");
  });

  it("reports a published-only model as unmeasured", () => {
    const history = new BenchmarkHistory([record({ modelId: "brochure-model", source: "published" })]);
    const summary = history.summarise("brochure-model", "repository.reasoning")!;
    expect(summary.measured).toBe(false);
    expect(summary.measuredRuns).toBe(0);
  });

  it("never lets a published claim outrank something that actually ran here", () => {
    const history = new BenchmarkHistory([
      record({ modelId: "brochure-model", quality: 0.99, source: "published" }),
      record({ modelId: "mid-8b-q4", quality: 0.6, source: "local-benchmark" }),
    ]);
    expect(history.leaderboard("repository.reasoning").map((s) => s.modelId)).toEqual([
      "mid-8b-q4",
      "brochure-model",
    ]);
  });

  it("knows nothing about a model it has never seen", () => {
    expect(new BenchmarkHistory().summarise("ghost", "repository.reasoning")).toBeNull();
  });

  it("round-trips and refuses a version it cannot read", () => {
    const history = new BenchmarkHistory([record()]);
    const restored = importBenchmarkHistory(JSON.stringify(history.toJSON("2026-07-31T00:00:00.000Z")));
    expect(restored.all()).toHaveLength(1);

    expect(() => importBenchmarkHistory(JSON.stringify({ version: 99 }))).toThrow(BenchmarkVersionError);
    expect(() => importBenchmarkHistory("{oops")).toThrow(/kein gültiges JSON/);
  });
});
