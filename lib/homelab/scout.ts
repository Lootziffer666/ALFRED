import { searchRepositories, type RepoSearchHit } from "../github";
import { classifyLicense } from "./huggingface";
import type { Availability } from "../schema/common";
import type { ExternalEntry, Need } from "../schema/corpus";
import type { LicenseStatus } from "../schema/homelab";

/**
 * Scout (plan §16). Given a confirmed need, it looks outside the starred pile
 * for donors, fork bases, dependencies and reference implementations.
 *
 * Everything it finds is `corpus: "external"` and `assessment: "unverified"`.
 * A find is never installed and never becomes project truth — the scoring
 * exists to make a human decision cheaper, not to make it automatically.
 */

export type DonorRole = "donor" | "fork-base" | "dependency" | "reference";

export interface ScoutQuery {
  /** What the project actually lacks. Only the project corpus produces these. */
  need: Pick<Need, "capabilityId"> & { label: string };
  /** Languages and frameworks the project already uses. */
  stack: string[];
  /** How permissive a licence has to be for this to be usable at all. */
  licenseRequirement: "permissive" | "any-open" | "any";
  /** Extra words to narrow the search. */
  keywords?: string[];
}

export interface ScoutScore {
  /** 0..1 each; every axis says what it was derived from. */
  functionCoverage: number;
  license: number;
  stackProximity: number;
  maintenance: number;
  tests: number;
  resourceFootprint: number;
  integrationEffort: number;
  securityRisk: number;
  total: number;
  role: DonorRole;
  /** Reasons this must not be adopted without a person looking. */
  blockers: string[];
  notes: string[];
}

export interface ScoutFinding {
  entry: ExternalEntry;
  hit: RepoSearchHit;
  score: ScoutScore;
}

/** Builds a GitHub search string from the need and the project's stack. */
export function buildSearchQuery(query: ScoutQuery): string {
  const words = [query.need.label, ...(query.keywords ?? [])].join(" ").trim();
  const parts = [words, "in:name,description,readme", "archived:false", "stars:>10"];
  if (query.stack[0]) parts.push(`language:${query.stack[0]}`);
  return parts.filter(Boolean).join(" ");
}

const MS_PER_DAY = 86_400_000;

function maintenanceScore(hit: RepoSearchHit, now: Date): { score: number; note: string } {
  if (hit.archived) return { score: 0, note: "Archiviert." };
  if (!hit.pushedAt) return { score: 0.2, note: "Kein Datum des letzten Pushes." };

  const days = (now.getTime() - Date.parse(hit.pushedAt)) / MS_PER_DAY;
  if (days <= 90) return { score: 1, note: `Zuletzt vor ${Math.round(days)} Tagen bewegt.` };
  if (days <= 365) return { score: 0.7, note: `Zuletzt vor ${Math.round(days)} Tagen bewegt.` };
  if (days <= 730) return { score: 0.4, note: `Seit ${Math.round(days / 30)} Monaten still.` };
  return { score: 0.1, note: `Seit über zwei Jahren still (${Math.round(days / 365)} Jahre).` };
}

function licenseScore(status: LicenseStatus, requirement: ScoutQuery["licenseRequirement"]) {
  if (status === "permissive") return 1;
  if (status === "copyleft") return requirement === "permissive" ? 0.2 : 0.7;
  if (status === "restricted") return 0.1;
  return 0;
}

function coverageScore(hit: RepoSearchHit, query: ScoutQuery): number {
  const haystack = `${hit.fullName} ${hit.description ?? ""} ${hit.topics.join(" ")}`.toLowerCase();
  const terms = [query.need.label, ...(query.keywords ?? [])]
    .join(" ")
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
  if (terms.length === 0) return 0;
  const hits = terms.filter((t) => haystack.includes(t)).length;
  return hits / terms.length;
}

function stackScore(hit: RepoSearchHit, stack: string[]): number {
  if (stack.length === 0) return 0.5;
  const language = (hit.language ?? "").toLowerCase();
  const index = stack.findIndex((s) => s.toLowerCase() === language);
  if (index === 0) return 1;
  if (index > 0) return 0.7;
  return 0.2;
}

/** Bigger repositories cost more to take on, whether as donor or dependency. */
function footprintScore(hit: RepoSearchHit): number {
  if (hit.sizeKb <= 2000) return 1;
  if (hit.sizeKb <= 20000) return 0.7;
  if (hit.sizeKb <= 100000) return 0.4;
  return 0.15;
}

function roleFor(score: Omit<ScoutScore, "role" | "total" | "blockers" | "notes">, license: LicenseStatus): DonorRole {
  // Without a usable licence nothing may be taken, only read.
  if (license === "unknown" || license === "restricted") return "reference";
  // Nobody is maintaining it, so taking anything means taking the maintenance
  // too. That is a fork, not a donor and certainly not a dependency.
  if (score.maintenance <= 0.4) return "fork-base";
  if (score.functionCoverage >= 0.75 && score.maintenance >= 0.7 && score.resourceFootprint >= 0.7) {
    return "dependency";
  }
  if (score.functionCoverage >= 0.6 && score.stackProximity >= 0.7) return "donor";
  return "reference";
}

export function scoreCandidate(hit: RepoSearchHit, query: ScoutQuery, now = new Date()): ScoutScore {
  const license = classifyLicense(hit.license);
  const maintenance = maintenanceScore(hit, now);
  const notes: string[] = [maintenance.note];
  const blockers: string[] = [];

  if (license === "unknown") blockers.push("Lizenz unklar — Übernahme ist ohne Klärung nicht zulässig.");
  if (license === "restricted") blockers.push("Lizenz beschränkt die Nutzung.");
  if (license === "copyleft" && query.licenseRequirement === "permissive") {
    blockers.push("Copyleft, obwohl das Projekt eine permissive Lizenz verlangt.");
  }
  if (hit.archived) blockers.push("Archiviert — es wird nichts mehr repariert.");
  if (hit.fork) notes.push("Ist selbst ein Fork; die Herkunft muss geprüft werden.");

  // GitHub search says nothing about tests, so this axis stays honest about
  // being unknown rather than inventing a number.
  const tests = 0;
  notes.push("Testlage nicht geprüft — die Suche sagt darüber nichts.");

  const axes = {
    functionCoverage: coverageScore(hit, query),
    license: licenseScore(license, query.licenseRequirement),
    stackProximity: stackScore(hit, query.stack),
    maintenance: maintenance.score,
    tests,
    resourceFootprint: footprintScore(hit),
    integrationEffort: footprintScore(hit) * 0.5 + stackScore(hit, query.stack) * 0.5,
    securityRisk: hit.archived ? 0.2 : Math.min(1, 0.4 + Math.log10(Math.max(hit.stars, 1)) / 5),
  };

  const total =
    0.25 * axes.functionCoverage +
    0.2 * axes.license +
    0.15 * axes.stackProximity +
    0.15 * axes.maintenance +
    0.1 * axes.resourceFootprint +
    0.1 * axes.integrationEffort +
    0.05 * axes.securityRisk;

  return { ...axes, total: Math.round(total * 1000) / 1000, role: roleFor(axes, license), blockers, notes };
}

function toExternalEntry(hit: RepoSearchHit, query: ScoutQuery, foundAt: string): ExternalEntry {
  const [owner, name] = hit.fullName.split("/");
  return {
    corpus: "external",
    assessment: "unverified",
    repo: { owner, name },
    addedAt: foundAt,
    capabilities: [
      {
        id: query.need.capabilityId,
        label: query.need.label,
        // Found, not read: the repository claims this, nobody checked it.
        truth: "declared",
        evidenceIds: [],
      },
    ],
  };
}

export interface ScoutResult {
  findings: ScoutFinding[];
  /** Why the search produced nothing, when it produced nothing. */
  unavailable?: { status: string; reason: string };
  query: string;
}

export async function scout(
  query: ScoutQuery,
  opts: { token?: string; perPage?: number; now?: () => Date } = {},
): Promise<ScoutResult> {
  const now = opts.now?.() ?? new Date();
  const search = buildSearchQuery(query);
  const result: Availability<RepoSearchHit[]> = await searchRepositories(search, opts);

  if (result.status !== "loaded") {
    return {
      findings: [],
      query: search,
      unavailable: { status: result.status, reason: (result as { reason?: string }).reason ?? "Unbekannt." },
    };
  }

  const findings = result.data
    .map((hit) => ({
      entry: toExternalEntry(hit, query, now.toISOString()),
      hit,
      score: scoreCandidate(hit, query, now),
    }))
    .sort((a, b) => b.score.total - a.score.total);

  return { findings, query: search };
}
