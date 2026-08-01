import type { LicenseStatus, ModelCandidate, RuntimeId } from "../schema/homelab";
import type { DetailedEvidenceRef } from "../schema/common";

/**
 * Hugging Face adapter (plan §14.6). Isolated the way `lib/openrouter.ts` is:
 * one place that talks to the provider, everything else works on
 * `ModelCandidate`.
 *
 * Nothing here is estimated that the API actually states. File sizes, the
 * parameter count and the context length are read from the repository, and the
 * effective bits per weight are computed from the two rather than looked up in
 * a table of approximations. What the API does not say — layer count and
 * hidden size — is left undefined, which the memory estimator then reflects in
 * its confidence instead of pretending to know.
 */

const API_ROOT = "https://huggingface.co/api";

export class HuggingFaceError extends Error {}

/** Split archives cannot be loaded as a single file, so they are not candidates. */
const SPLIT_FILE = /-\d{5}-of-\d{5}\.gguf$/i;
const GGUF_FILE = /\.gguf$/i;

const PERMISSIVE = /^(apache-2\.0|mit|bsd(-\d.*)?|isc|unlicense|cc0-1\.0|cc-by-4\.0|artistic-2\.0)$/i;
const COPYLEFT = /^(gpl|agpl|lgpl|mpl|epl|osl|cc-by-sa)/i;
const RESTRICTED = /(nc|nd|openrail|rail|llama\d?|gemma|research|proprietary|other)/i;

/** Maps a Hugging Face licence identifier onto what ALFRET may act on. */
export function classifyLicense(raw: string | null | undefined): LicenseStatus {
  if (!raw) return "unknown";
  const value = raw.trim().toLowerCase();
  if (PERMISSIVE.test(value)) return "permissive";
  if (COPYLEFT.test(value)) return "copyleft";
  if (RESTRICTED.test(value)) return "restricted";
  return "unknown";
}

/** `Q4_K_M` out of `Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf`. */
export function quantizationLabel(filename: string): string | undefined {
  const match = filename.match(/[.-](I?Q\d+(?:_[A-Z0-9]+)*|f?p?16|bf16|f32)\.gguf$/i);
  return match ? match[1].toUpperCase() : undefined;
}

export interface HfSibling {
  rfilename: string;
  size?: number;
  lfs?: { sha256?: string };
}

export interface HfModel {
  id: string;
  sha?: string;
  gated?: boolean | string;
  private?: boolean;
  tags?: string[];
  downloads?: number;
  likes?: number;
  cardData?: { license?: string; base_model?: string | string[] };
  gguf?: { total?: number; architecture?: string; context_length?: number };
  siblings?: HfSibling[];
}

/** The fields of a `config.json` the memory estimate actually needs. */
export interface HfArchitecture {
  layers: number;
  hiddenSize: number;
  /** `kvHeads × headDim` — what the KV cache scales with under GQA. */
  kvDim: number;
}

interface HfConfigJson {
  num_hidden_layers?: number;
  hidden_size?: number;
  num_attention_heads?: number;
  num_key_value_heads?: number;
  head_dim?: number;
}

export function architectureFrom(config: HfConfigJson): HfArchitecture | null {
  const { num_hidden_layers: layers, hidden_size: hidden, num_attention_heads: heads } = config;
  if (!layers || !hidden || !heads) return null;

  const headDim = config.head_dim ?? Math.floor(hidden / heads);
  // Without a stated KV head count the model is multi-head, so KV is full width.
  const kvHeads = config.num_key_value_heads ?? heads;
  return { layers, hiddenSize: hidden, kvDim: kvHeads * headDim };
}

function licenseFromModel(model: HfModel): LicenseStatus {
  if (model.cardData?.license) return classifyLicense(model.cardData.license);
  const tag = model.tags?.find((t) => t.startsWith("license:"));
  return classifyLicense(tag?.slice("license:".length));
}

function runtimesFor(filename: string): RuntimeId[] {
  return GGUF_FILE.test(filename) ? ["ollama", "llama.cpp", "termux-llama.cpp"] : ["vllm"];
}

/**
 * Turns one repository into one candidate per usable quantisation. A gated or
 * private repository still yields candidates — blocked ones, so the planner
 * can say *why* it will not use them rather than silently omitting them.
 */
export function candidatesFrom(model: HfModel, architecture?: HfArchitecture | null): ModelCandidate[] {
  const license = licenseFromModel(model);
  const gated = Boolean(model.gated);
  const paramsB = model.gguf?.total ? model.gguf.total / 1e9 : undefined;
  const contextLength = model.gguf?.context_length ?? 8192;

  const files = (model.siblings ?? []).filter(
    (s) => GGUF_FILE.test(s.rfilename) && !SPLIT_FILE.test(s.rfilename) && typeof s.size === "number",
  );

  return files.map((file) => {
    const fileSizeGb = file.size! / 1e9;
    // Real bits per weight, from the real file and the real parameter count.
    const quantBits = paramsB ? (file.size! * 8) / (paramsB * 1e9) : undefined;

    const evidence: DetailedEvidenceRef[] = [
      {
        source: `huggingface.co/${model.id} · ${file.rfilename}`,
        url: `https://huggingface.co/${model.id}/blob/main/${file.rfilename}`,
        repository: model.id,
        path: file.rfilename,
        commitSha: model.sha,
        artifactHash: file.lfs?.sha256 ? `sha256:${file.lfs.sha256}` : undefined,
      },
    ];

    return {
      id: `${model.id}::${file.rfilename}`,
      repository: model.id,
      revision: model.sha ?? "main",
      format: "gguf" as const,
      quantization: quantizationLabel(file.rfilename),
      quantBits,
      fileSizeGb: Math.round(fileSizeGb * 1000) / 1000,
      paramsB: paramsB ? Math.round(paramsB * 100) / 100 : undefined,
      layers: architecture?.layers,
      hiddenSize: architecture?.hiddenSize,
      kvDim: architecture?.kvDim,
      contextLength,
      runtimes: runtimesFor(file.rfilename),
      license,
      gated,
      evidence,
    };
  });
}

export interface HfSearchParams {
  query: string;
  limit?: number;
  /** Optional token for gated or private repositories. */
  token?: string;
}

async function hfFetch<T>(path: string, token?: string): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_ROOT}${path}`, { headers });
  } catch (err) {
    throw new HuggingFaceError(`Hugging Face nicht erreichbar: ${(err as Error).message}`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new HuggingFaceError("Hugging Face verweigert den Zugriff — das Repository ist vermutlich gated.");
  }
  if (res.status === 404) throw new HuggingFaceError("Auf Hugging Face nicht gefunden.");
  if (!res.ok) throw new HuggingFaceError(`Hugging Face antwortete mit HTTP ${res.status}.`);

  try {
    return (await res.json()) as T;
  } catch {
    throw new HuggingFaceError("Antwort von Hugging Face war kein JSON.");
  }
}

/** Repository detail including per-file sizes — the only call that has them. */
export function fetchModel(repository: string, token?: string): Promise<HfModel> {
  return hfFetch<HfModel>(`/models/${repository}?blobs=true`, token);
}

function baseModelOf(model: HfModel): string | undefined {
  const base = model.cardData?.base_model;
  return Array.isArray(base) ? base[0] : base;
}

/**
 * The attention geometry, read from `config.json` rather than guessed. A GGUF
 * repository usually carries no config of its own, so the base model it was
 * quantised from is tried as well. Best effort: on failure the estimate simply
 * keeps a wider range and a lower confidence.
 */
export async function fetchArchitecture(model: HfModel, token?: string): Promise<HfArchitecture | null> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  for (const repository of [model.id, baseModelOf(model)].filter((r): r is string => Boolean(r))) {
    try {
      const res = await fetch(`https://huggingface.co/${repository}/resolve/main/config.json`, {
        headers,
        redirect: "follow",
      });
      if (!res.ok) continue;
      const architecture = architectureFrom((await res.json()) as HfConfigJson);
      if (architecture) return architecture;
    } catch {
      // Try the next source; an unreachable config is not an error here.
    }
  }
  return null;
}

export function searchModels(params: HfSearchParams): Promise<HfModel[]> {
  const query = new URLSearchParams({
    search: params.query,
    filter: "gguf",
    sort: "downloads",
    direction: "-1",
    limit: String(params.limit ?? 10),
  });
  return hfFetch<HfModel[]>(`/models?${query.toString()}`, params.token);
}

/**
 * Search, then fetch each hit's detail for the file sizes the search endpoint
 * omits. A repository that fails to load is skipped with its reason rather
 * than failing the whole search.
 */
export async function findCandidates(params: HfSearchParams): Promise<{
  candidates: ModelCandidate[];
  skipped: { repository: string; reason: string }[];
}> {
  const hits = await searchModels(params);
  const candidates: ModelCandidate[] = [];
  const skipped: { repository: string; reason: string }[] = [];

  for (const hit of hits) {
    try {
      const detail = await fetchModel(hit.id, params.token);
      const architecture = await fetchArchitecture(detail, params.token);
      const built = candidatesFrom(detail, architecture);
      if (built.length === 0) {
        skipped.push({ repository: hit.id, reason: "Keine einzelne GGUF-Datei mit bekannter Größe." });
        continue;
      }
      candidates.push(...built);
    } catch (err) {
      skipped.push({ repository: hit.id, reason: (err as Error).message });
    }
  }

  return { candidates, skipped };
}
