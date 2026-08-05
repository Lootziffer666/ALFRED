// plan §30 — loadPlanFromRepo() -> ParsedPlan, mit optional Caching.
// Einfach, weil der Parser bereits rein ist.

import { parsePlan, type ParsedPlan } from "./parse";

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

/**
 * Der zusammen mit dem Plan abgelegte SHA wurde bisher nie wieder gelesen —
 * der Cache konnte also einen Plan zu einem längst überholten Commit
 * zurückgeben. Wer einen SHA mitgibt, bekommt den Plan nur, wenn er zu genau
 * diesem Commit gehört.
 */
export function getCachedPlan(sha?: string): ParsedPlan | null {
  if (sha !== undefined && sha !== cachedSha) return null;
  return cachedPlan;
}

/** Der SHA, zu dem der zwischengespeicherte Plan gehört. */
export function getCachedPlanSha(): string | null {
  return cachedSha;
}

export function clearCache(): void {
  cachedPlan = null;
  cachedSha = null;
}
