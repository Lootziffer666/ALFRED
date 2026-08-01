// plan §27 — Geschwister zu fetchCompareFiles (lib/github.ts:491), das
// aheadBy/behindBy/status heute wegwirft. Genau die Felder, die Etappe 32
// (Branch-Pflege) später braucht.

import { ghFetch, type GhFetchOptions } from "../github.js";

export interface CompareRefsResult {
  status: "ahead" | "behind" | "diverged" | "identical";
  aheadBy: number;
  behindBy: number;
  files: Array<{ path: string; status: string }>;
}

export async function compareRefs(
  repository: string,
  base: string,
  head: string,
  token: string,
  opts: GhFetchOptions = {},
): Promise<CompareRefsResult> {
  const [owner, repo] = repository.split("/");
  const result = await ghFetch<{
    status: string;
    ahead_by: number;
    behind_by: number;
    files?: Array<{ filename: string; status: string }>;
  }>(
    `https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`,
    token,
    opts,
  );

  if (!result.ok || !result.data) {
    throw new Error(
      `compareRefs fehlgeschlagen: ${result.error ?? result.status}`,
    );
  }

  return {
    status: result.data.status as CompareRefsResult["status"],
    aheadBy: result.data.ahead_by,
    behindBy: result.data.behind_by,
    files: (result.data.files ?? []).map((f) => ({
      path: f.filename,
      status: f.status,
    })),
  };
}
