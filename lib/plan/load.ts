// plan §30 — loadPlanFromRepo() -> ParsedPlan, mit optional Caching.
// Einfach, weil der Parser bereits rein ist.

import { parsePlan, type ParsedPlan } from "./parse.js";

let cachedPlan: ParsedPlan | null = null;
let cachedSha: string | null = null;

export async function loadPlanFromRepo(
  repository: string,
  token: string,
  fetchImpl?: typeof fetch,
): Promise<ParsedPlan> {
  const fetch_ = fetchImpl || fetch;
  const [owner, repo] = repository.split("/");

  const res = await fetch_(
    `https://api.github.com/repos/${owner}/${repo}/contents/PLAN.md`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3.raw",
      },
    },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch PLAN.md: ${res.status}`);
  }

  const content = await res.text();
  return parsePlan(content);
}

// Optional: In-memory cache für wiederholte Zugriffe in derselben Tick.
export function setCachedPlan(plan: ParsedPlan, sha?: string): void {
  cachedPlan = plan;
  cachedSha = sha || null;
}

export function getCachedPlan(): ParsedPlan | null {
  return cachedPlan;
}

export function clearCache(): void {
  cachedPlan = null;
  cachedSha = null;
}
