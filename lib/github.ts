import {
  type Availability,
  type RepoEvidence,
  type FileEntry,
  type DocEvidence,
  type PackageManifest,
  type CommitEvidence,
  type PullRequestSummary,
  type IssueSummary,
  type ChangedFile,
  loaded,
  unavailable,
} from "./schema";

const API_ROOT = "https://api.github.com";
const MAX_TREE_ENTRIES = 4000;
const MAX_DOC_EXCERPT_CHARS = 6000;
const DOC_NAME_PATTERN =
  /^(readme|plan|agents|claude|architecture|rules?|conventions?|contributing)(\.[a-z0-9]+)?$/i;

export class GitHubInputError extends Error {}

export interface NormalizedRepoInput {
  owner: string;
  name: string;
}

/** Accepts "owner/repo", a full github.com URL, or a PR/compare URL and extracts owner+repo. */
export function normalizeRepoInput(raw: string): NormalizedRepoInput {
  const trimmed = raw.trim();
  if (!trimmed) throw new GitHubInputError("Repository input is empty.");

  let owner: string | undefined;
  let name: string | undefined;

  if (/^[\w.-]+\/[\w.-]+$/.test(trimmed)) {
    [owner, name] = trimmed.split("/");
  } else {
    try {
      const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      if (!/(^|\.)github\.com$/.test(url.hostname)) {
        throw new GitHubInputError(`"${raw}" is not a recognized GitHub URL or owner/repo pair.`);
      }
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts.length < 2) {
        throw new GitHubInputError(`Could not find an owner and repository name in "${raw}".`);
      }
      [owner, name] = parts;
    } catch (err) {
      if (err instanceof GitHubInputError) throw err;
      throw new GitHubInputError(`"${raw}" is not a valid repository reference.`);
    }
  }

  name = name?.replace(/\.git$/, "");
  if (!owner || !name) {
    throw new GitHubInputError(`Could not parse an owner/repository pair from "${raw}".`);
  }
  return { owner, name };
}

interface GhRequestOptions {
  token?: string;
  accept?: string;
}

type GhResult<T> =
  | { ok: true; data: T }
  | { ok: false; kind: "permissions" | "rate_limited" | "failed"; reason: string };

function ghFetchResultToGhResult<T>(result: GhFetchResult<T>): GhResult<T> {
  if (result.ok && result.data !== undefined) {
    return { ok: true, data: result.data };
  }
  return { ok: false, kind: "failed", reason: result.error || "Unknown error" };
}

async function ghFetchLegacy<T>(path: string, opts: GhRequestOptions = {}): Promise<GhResult<T>> {
  const headers: Record<string, string> = {
    Accept: opts.accept ?? "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let res: Response;
  try {
    res = await fetch(`${API_ROOT}${path}`, { headers });
  } catch (err) {
    return { ok: false, kind: "failed", reason: `Network error contacting GitHub: ${(err as Error).message}` };
  }

  if (res.status === 401) {
    return { ok: false, kind: "permissions", reason: "GitHub rejected the provided token (401 Unauthorized)." };
  }
  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      const reset = res.headers.get("x-ratelimit-reset");
      const resetDate = reset ? new Date(Number(reset) * 1000).toISOString() : "unknown";
      return { ok: false, kind: "rate_limited", reason: `GitHub API rate limit exhausted. Resets at ${resetDate}.` };
    }
    return { ok: false, kind: "permissions", reason: "GitHub denied access (403). The resource may be private." };
  }
  if (res.status === 404) {
    return { ok: false, kind: "permissions", reason: "Not found or not accessible with the current credentials (404)." };
  }
  if (!res.ok) {
    return { ok: false, kind: "failed", reason: `GitHub responded with HTTP ${res.status}.` };
  }

  try {
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, kind: "failed", reason: "GitHub response could not be parsed as JSON." };
  }
}

function toAvailability<T>(result: GhResult<T>): Availability<T> {
  if (result.ok) return loaded(result.data);
  return unavailable(
    result.kind === "permissions"
      ? "unavailable_permissions"
      : result.kind === "rate_limited"
        ? "unavailable_rate_limited"
        : "failed",
    result.reason,
  );
}

interface GhRepoMeta {
  default_branch: string;
  description: string | null;
  private: boolean;
  html_url: string;
  open_issues_count: number;
}

interface GhTreeEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
}
interface GhTreeResponse {
  tree: GhTreeEntry[];
  truncated: boolean;
}

interface GhCommit {
  sha: string;
  html_url: string;
  commit: { message: string; author: { name?: string; date?: string } | null };
}

interface GhPull {
  number: number;
  title: string;
  state: string;
  html_url: string;
}

export interface FetchEvidenceParams {
  owner: string;
  name: string;
  ref?: string;
  token?: string;
}

export async function fetchRepoEvidence(params: FetchEvidenceParams): Promise<RepoEvidence> {
  const { owner, name, token } = params;
  const warnings: string[] = [];

  if (!token) {
    throw new GitHubInputError("GitHub token is required to fetch repository evidence");
  }

  const metaResult = await ghFetch<GhRepoMeta>(`${API_ROOT}/repos/${owner}/${name}`, token);
  if (!metaResult.ok || !metaResult.data) {
    throw new GitHubInputError(
      `Could not load repository ${owner}/${name}: ${metaResult.error || "Unknown error"}`,
    );
  }
  const meta = metaResult.data;
  const ref = params.ref?.trim() || meta.default_branch;

  const [treeResult, commitsResult, pullsResult] = await Promise.all([
    ghFetch<GhTreeResponse>(`${API_ROOT}/repos/${owner}/${name}/git/trees/${encodeURIComponent(ref)}?recursive=1`, token),
    ghFetch<GhCommit[]>(`${API_ROOT}/repos/${owner}/${name}/commits?sha=${encodeURIComponent(ref)}&per_page=15`, token),
    ghFetch<GhPull[]>(`${API_ROOT}/repos/${owner}/${name}/pulls?state=open&per_page=10`, token),
  ]);

  let tree: Availability<FileEntry[]>;
  let treeEntries: GhTreeEntry[] = [];
  if (treeResult.ok && treeResult.data) {
    treeEntries = treeResult.data.tree;
    if (treeResult.data.truncated) {
      warnings.push(`Repository tree was truncated by GitHub beyond ${treeEntries.length} entries.`);
    }
    const limited = treeEntries.slice(0, MAX_TREE_ENTRIES);
    if (treeEntries.length > MAX_TREE_ENTRIES) {
      warnings.push(`Tree limited to first ${MAX_TREE_ENTRIES} of ${treeEntries.length} entries (safety limit).`);
    }
    tree = loaded(
      limited.map((e) => ({
        path: e.path,
        type: e.type === "tree" ? "dir" : "file",
        size: e.size,
      })),
    );
  } else {
    tree = unavailable("failed", treeResult.error || "Could not fetch repository tree");
  }

  const docs = await fetchDocEvidence({ owner, name, ref, token, treeEntries });
  const packageManifest = await fetchPackageManifest({ owner, name, ref, token, treeEntries });

  const commits: Availability<CommitEvidence[]> = commitsResult.ok && commitsResult.data
    ? loaded(
        commitsResult.data.map((c) => ({
          sha: c.sha.slice(0, 12),
          message: c.commit.message.split("\n")[0],
          author: c.commit.author?.name ?? null,
          date: c.commit.author?.date ?? null,
          url: c.html_url,
        })),
      )
    : unavailable("failed", commitsResult.error || "Could not fetch commits");

  let pullRequests: Availability<PullRequestSummary>;
  let openPullCount = 0;
  if (pullsResult.ok && pullsResult.data) {
    openPullCount = pullsResult.data.length;
    pullRequests = loaded({
      openCount: pullsResult.data.length,
      recent: pullsResult.data.slice(0, 5).map((p) => ({
        number: p.number,
        title: p.title,
        state: p.state,
        url: p.html_url,
      })),
    });
  } else {
    pullRequests = unavailable("failed", pullsResult.error || "Could not fetch pull requests");
  }

  const issues: Availability<IssueSummary> = pullsResult.ok && pullsResult.data
    ? loaded({ openCount: Math.max(0, meta.open_issues_count - openPullCount) })
    : loaded({ openCount: meta.open_issues_count });
  if (!pullsResult.ok) {
    warnings.push("Open issue count includes open pull requests because the pulls endpoint was unavailable.");
  }

  return {
    identity: {
      owner,
      name,
      ref,
      url: meta.html_url,
      defaultBranch: meta.default_branch,
      description: meta.description,
      private: meta.private,
    },
    fetchedAt: new Date().toISOString(),
    tree,
    docs,
    packageManifest,
    commits,
    pullRequests,
    issues,
    warnings,
  };
}

export interface RepoSearchHit {
  fullName: string;
  description: string | null;
  url: string;
  stars: number;
  language: string | null;
  license: string | null;
  pushedAt: string | null;
  openIssues: number;
  topics: string[];
  sizeKb: number;
  archived: boolean;
  fork: boolean;
}

interface GhSearchResponse {
  items: {
    full_name: string;
    description: string | null;
    html_url: string;
    stargazers_count: number;
    language: string | null;
    license: { spdx_id?: string | null } | null;
    pushed_at: string | null;
    open_issues_count: number;
    topics?: string[];
    size: number;
    archived: boolean;
    fork: boolean;
  }[];
}

/**
 * Repository search, used by the scout. Kept here so every GitHub REST call
 * still lives in this one adapter.
 */
export async function searchRepositories(
  query: string,
  opts: { token?: string; perPage?: number } = {},
): Promise<Availability<RepoSearchHit[]>> {
  const params = new URLSearchParams({
    q: query,
    sort: "stars",
    order: "desc",
    per_page: String(opts.perPage ?? 10),
  });
  const result = await ghFetch<GhSearchResponse>(
    `${API_ROOT}/search/repositories?${params.toString()}`,
    opts.token ?? "",
  );

  if (!result.ok || !result.data) {
    return unavailable("failed", result.error || "Could not fetch repositories");
  }

  const data = result.data;
  return loaded(
    data.items.map((item) => ({
      fullName: item.full_name,
      description: item.description,
      url: item.html_url,
      stars: item.stargazers_count,
      language: item.language,
      license: item.license?.spdx_id ?? null,
      pushedAt: item.pushed_at,
      openIssues: item.open_issues_count,
      topics: item.topics ?? [],
      sizeKb: item.size,
      archived: item.archived,
      fork: item.fork,
    })),
  );
}

async function fetchFileText(
  owner: string,
  name: string,
  ref: string,
  path: string,
  token?: string,
): Promise<string | null> {
  const result = await ghFetch<{ content?: string; encoding?: string }>(
    `${API_ROOT}/repos/${owner}/${name}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(ref)}`,
    token ?? "",
  );
  if (!result.ok || !result.data?.content) return null;
  const data = result.data;
  try {
    return Buffer.from(result.data.content, "base64").toString("utf-8");
  } catch {
    return null;
  }
}

async function fetchDocEvidence(args: {
  owner: string;
  name: string;
  ref: string;
  token?: string;
  treeEntries: GhTreeEntry[];
}): Promise<Availability<DocEvidence[]>> {
  const { owner, name, ref, token, treeEntries } = args;
  if (treeEntries.length === 0) {
    return unavailable("skipped", "No tree available to locate documentation files.");
  }

  const candidates = treeEntries
    .filter((e) => e.type === "blob")
    .filter((e) => {
      const base = e.path.split("/").pop() ?? "";
      const isRootDoc = !e.path.includes("/") && DOC_NAME_PATTERN.test(base);
      const isDocsMd = /^docs\//i.test(e.path) && /\.mdx?$/i.test(base);
      return isRootDoc || isDocsMd;
    })
    // Root documents carry the repository's own rules, so they keep their place
    // in the budget even when docs/ is large.
    .sort((a, b) => Number(a.path.includes("/")) - Number(b.path.includes("/")))
    .slice(0, 12);

  const docs: DocEvidence[] = [];
  for (const entry of candidates) {
    const text = await fetchFileText(owner, name, ref, entry.path, token);
    if (text === null) continue;
    const truncated = text.length > MAX_DOC_EXCERPT_CHARS;
    docs.push({
      path: entry.path,
      excerpt: truncated ? text.slice(0, MAX_DOC_EXCERPT_CHARS) : text,
      truncated,
      fullLength: text.length,
    });
  }
  return loaded(docs);
}

const STACK_HINTS: Array<[RegExp, string]> = [
  [/^next$/, "Next.js"],
  [/^react$/, "React"],
  [/^typescript$/, "TypeScript"],
  [/^vitest$/, "Vitest"],
  [/^jest$/, "Jest"],
  [/^express$/, "Express"],
  [/^tailwindcss$/, "Tailwind CSS"],
  [/^vue$/, "Vue"],
  [/^svelte$/, "Svelte"],
];

async function fetchPackageManifest(args: {
  owner: string;
  name: string;
  ref: string;
  token?: string;
  treeEntries: GhTreeEntry[];
}): Promise<Availability<PackageManifest | null>> {
  const { owner, name, ref, token, treeEntries } = args;
  const hasPackageJson = treeEntries.some((e) => e.path === "package.json");
  if (!hasPackageJson) {
    return loaded(null);
  }
  const text = await fetchFileText(owner, name, ref, "package.json", token);
  if (text === null) {
    return unavailable("failed", "package.json listed in the tree but its content could not be fetched.");
  }
  try {
    const parsed = JSON.parse(text) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = { ...parsed.dependencies, ...parsed.devDependencies };
    const detectedStack = STACK_HINTS.filter(([re]) =>
      Object.keys(deps).some((d) => re.test(d)),
    ).map(([, label]) => label);
    const packageManager = treeEntries.some((e) => e.path === "bun.lock" || e.path === "bun.lockb")
      ? "bun"
      : treeEntries.some((e) => e.path === "pnpm-lock.yaml")
        ? "pnpm"
        : treeEntries.some((e) => e.path === "yarn.lock")
          ? "yarn"
          : treeEntries.some((e) => e.path === "package-lock.json")
            ? "npm"
            : null;
    return loaded({
      path: "package.json",
      detectedStack,
      packageManager,
      scripts: parsed.scripts ?? {},
    });
  } catch {
    return unavailable("failed", "package.json could not be parsed as JSON.");
  }
}

// ---------------------------------------------------------------------------
// Diff / audit-side fetches
// ---------------------------------------------------------------------------

interface GhDiffFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

function mapStatus(status: string): ChangedFile["status"] {
  if (status === "added") return "added";
  if (status === "removed") return "removed";
  if (status === "renamed") return "renamed";
  return "modified";
}

export async function fetchPullRequestFiles(
  owner: string,
  name: string,
  pullNumber: number,
  token?: string,
): Promise<{ files: ChangedFile[] } | { error: string }> {
  const result = await ghFetch<GhDiffFile[]>(
    `${API_ROOT}/repos/${owner}/${name}/pulls/${pullNumber}/files?per_page=100`,
    token ?? "",
  );
  if (!result.ok || !result.data) return { error: "Failed to fetch PR files" };
  return {
    files: result.data.map((f) => ({
      path: f.filename,
      status: mapStatus(f.status),
      additions: f.additions,
      deletions: f.deletions,
      patchExcerpt: f.patch?.slice(0, 2000),
    })),
  };
}

export async function fetchCompareFiles(
  owner: string,
  name: string,
  base: string,
  head: string,
  token?: string,
): Promise<{ files: ChangedFile[] } | { error: string }> {
  const result = await ghFetch<{ files: GhDiffFile[] }>(
    `${API_ROOT}/repos/${owner}/${name}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
    token ?? "",
  );
  if (!result.ok || !result.data?.files) return { error: "Failed to fetch compare files" };
  return {
    files: result.data.files.map((f) => ({
      path: f.filename,
      status: mapStatus(f.status),
      additions: f.additions,
      deletions: f.deletions,
      patchExcerpt: f.patch?.slice(0, 2000),
    })),
  };
}

/** Extract owner/repo/number from a PR URL, or owner/repo/base/head from a compare URL. */
export function parseGitHubResourceUrl(
  raw: string,
):
  | { kind: "pull_request"; owner: string; name: string; number: number }
  | { kind: "compare"; owner: string; name: string; base: string; head: string }
  | { kind: "invalid"; reason: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { kind: "invalid", reason: "Not a valid URL." };
  }
  if (!/(^|\.)github\.com$/.test(url.hostname)) {
    return { kind: "invalid", reason: "Not a github.com URL." };
  }
  const parts = url.pathname.split("/").filter(Boolean);
  const [owner, name, kind, ref] = parts;
  if (!owner || !name || !kind) return { kind: "invalid", reason: "URL is missing repository path segments." };
  if (kind === "pull" && ref) {
    const number = Number(ref);
    if (Number.isNaN(number)) return { kind: "invalid", reason: "Pull request number is not numeric." };
    return { kind: "pull_request", owner, name, number };
  }
  if (kind === "compare" && ref) {
    const [base, head] = ref.split("...");
    if (!base || !head) return { kind: "invalid", reason: "Compare URL must contain base...head." };
    return { kind: "compare", owner, name, base, head };
  }
  return { kind: "invalid", reason: "URL is neither a pull request nor a compare URL." };
}

/** Minimal unified-diff parser for the pasted-diff audit path (no GitHub call needed). */
export function parseUnifiedDiff(diffText: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  const lines = diffText.split("\n");
  let current: {
    path: string;
    additions: number;
    deletions: number;
    patch: string[];
    status: ChangedFile["status"];
  } | null = null;

  const flush = () => {
    if (!current) return;
    files.push({
      path: current.path,
      status: current.status,
      additions: current.additions,
      deletions: current.deletions,
      patchExcerpt: current.patch.slice(0, 40).join("\n").slice(0, 2000),
    });
  };

  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      flush();
      const match = line.match(/diff --git a\/(.+?) b\/(.+)$/);
      current = {
        path: match ? match[2] : line.replace("diff --git ", ""),
        additions: 0,
        deletions: 0,
        patch: [],
        status: "modified",
      };
      continue;
    }
    if (!current) continue;
    if (line.startsWith("new file mode")) current.status = "added";
    if (line.startsWith("deleted file mode")) current.status = "removed";
    if (line.startsWith("rename from")) current.status = "renamed";
    current.patch.push(line);
    if (line.startsWith("+") && !line.startsWith("+++")) current.additions++;
    if (line.startsWith("-") && !line.startsWith("---")) current.deletions++;
  }
  flush();
  return files;
}

// plan §27 — Neuer ghFetch Export für Daemon-Schicht: mit method, body, fetchImpl.
export interface GhFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  fetchImpl?: typeof fetch;
}

export interface GhFetchResult<T> {
  ok: boolean;
  status: number;
  data: T | undefined;
  error?: string;
}

export async function ghFetch<T>(
  url: string,
  token: string,
  opts: GhFetchOptions = {},
): Promise<GhFetchResult<T>> {
  const { method = "GET", body, fetchImpl = fetch } = opts;

  const res = await fetchImpl(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) {
    return { ok: true, status: 204, data: undefined };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, status: res.status, data: undefined, error: text };
  }

  const data = (await res.json()) as T;
  return { ok: true, status: res.status, data };
}
