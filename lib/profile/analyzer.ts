/**
 * Developer-Profil-Analyzer (Etappe 14a).
 *
 * Nimmt eine ProfileSource (rohe GitHub-Daten) und erzeugt
 * ein strukturiertes DeveloperProfile.
 */

import type {
  ProfileSource, ProfileRepo, DeveloperProfile, ProfileSkill,
  ProfileProject, ProfileTimeline, ProfileDomain,
  LanguageEpoch, CareerPhase, EvidenceStatement,
  SkillCategory, SkillConfidence,
} from "./types";
import type { DetailedEvidenceRef } from "@/lib/schema/common";

function makeProfileId(login: string): string {
  return `profile-${login}-${Date.now()}`;
}

function repoEvidence(repo: ProfileRepo, symbol?: string): DetailedEvidenceRef {
  return {
    source: "github-api",
    repository: repo.fullName,
    path: symbol ? undefined : ".",
    symbol,
    observedAt: repo.pushedAt,
  };
}

// ── Sprach-Aggregation ────────────────────────────────────────────────────

interface LangStats {
  bytes: number;
  repos: string[];
  primaryRepo: string | null;
}

function aggregateLanguages(repos: ProfileRepo[]): Map<string, LangStats> {
  const map = new Map<string, LangStats>();

  for (const repo of repos) {
    if (repo.isForked || repo.isMirror) continue;

    for (const [lang, bytes] of Object.entries(repo.languages)) {
      const existing = map.get(lang) ?? { bytes: 0, repos: [], primaryRepo: null };
      existing.bytes += bytes;
      existing.repos.push(repo.name);
      if (!existing.primaryRepo) {
        existing.primaryRepo = repo.fullName;
      }
      map.set(lang, existing);
    }
  }

  return map;
}

const LANGUAGE_CATEGORY: Record<string, SkillCategory> = {
  TypeScript: "language", JavaScript: "language", Python: "language",
  Rust: "language", Go: "language", Java: "language",
  Shell: "tooling", Dockerfile: "infrastructure",
};

const TOPIC_SKILLS: Array<{ pattern: RegExp; name: string; category: SkillCategory }> = [
  { pattern: /\bnext\.?js\b/i,    name: "Next.js",    category: "framework" },
  { pattern: /\breact\b/i,        name: "React",      category: "framework" },
  { pattern: /\bvue\b/i,          name: "Vue",        category: "framework" },
  { pattern: /\bdocker\b/i,       name: "Docker",     category: "infrastructure" },
  { pattern: /\bkubernetes\b/i,   name: "Kubernetes", category: "infrastructure" },
];

function extractSkills(repos: ProfileRepo[]): ProfileSkill[] {
  const skills: ProfileSkill[] = [];
  const langStats = aggregateLanguages(repos);
  const totalBytes = Array.from(langStats.values()).reduce((sum, s) => sum + s.bytes, 1);

  for (const [lang, stats] of langStats) {
    const category = LANGUAGE_CATEGORY[lang] ?? "language";
    const codeShare = stats.bytes / totalBytes;

    if (codeShare > 0.01) {
      skills.push({
        name: lang,
        category,
        confidence: "observed",
        truthStatus: "observed",
        evidence: [repoEvidence(repos.find(r => r.fullName === stats.primaryRepo)!)],
        codeShare,
        repoCount: stats.repos.length,
        primaryRepo: stats.primaryRepo,
      });
    }
  }

  // Extract framework/tool skills from repo topics
  const topicSkills = new Set<string>();
  for (const repo of repos) {
    if (repo.isForked || repo.isMirror) continue;
    for (const topic of repo.topics) {
      for (const skill of TOPIC_SKILLS) {
        if (skill.pattern.test(topic)) {
          const existing = skills.find(s => s.name === skill.name);
          if (!existing) {
            skills.push({
              name: skill.name,
              category: skill.category,
              confidence: "observed",
              truthStatus: "observed",
              codeShare: 0,
              evidence: [repoEvidence(repo)],
              repoCount: 1,
              primaryRepo: repo.fullName,
            });
            topicSkills.add(skill.name);
          }
        }
      }
    }
  }

  return skills.sort((a, b) => (b.codeShare ?? 0) - (a.codeShare ?? 0));
}

function extractProjects(repos: ProfileRepo[]): ProfileProject[] {
  return repos
    .filter(r => !r.isForked && !r.isMirror)
    .sort((a, b) => b.stars - a.stars)
    .slice(0, 10)
    .map((repo) => ({
      repoName: repo.name,
      fullName: repo.fullName,
      url: repo.url,
      headline: repo.description ?? `${repo.name} repository`,
      role: "author",
      truthStatus: "observed",
      usageSignals: [
        ...(repo.stars > 0 ? [{ kind: "stars" as const, value: repo.stars, note: `${repo.stars} stars` }] : []),
        ...(repo.forks > 0 ? [{ kind: "forks" as const, value: repo.forks, note: `${repo.forks} forks` }] : []),
        ...(repo.hasReleases ? [{ kind: "release" as const, value: repo.latestRelease ?? "yes", note: "Has releases" }] : []),
      ],
      languages: Object.keys(repo.languages).slice(0, 3),
      topics: repo.topics,
      hasRelease: repo.hasReleases,
      isOriginal: true,
      evidence: [repoEvidence(repo)],
    }));
}

function extractTimeline(repos: ProfileRepo[]): ProfileTimeline {
  if (repos.length === 0) {
    return { firstRepoAt: null, peakYear: null, languageEvolution: [], phases: [] };
  }

  const sorted = [...repos].sort((a, b) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const firstRepo = sorted[0];
  const years = new Map<number, number>();

  for (const repo of repos) {
    const year = new Date(repo.createdAt).getFullYear();
    years.set(year, (years.get(year) ?? 0) + 1);
  }

  const peakYear = Array.from(years.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    firstRepoAt: firstRepo.createdAt,
    peakYear,
    languageEvolution: Array.from(years.entries())
      .map(([year, count]) => ({
        year,
        topLanguage: "Mixed",
        repoCount: count,
      }))
      .sort((a, b) => a.year - b.year),
    phases: [],
  };
}

export function analyzeProfile(source: ProfileSource): DeveloperProfile {
  const skills = extractSkills(source.repos);
  const projects = extractProjects(source.repos);
  const timeline = extractTimeline(source.repos);

  const domains: ProfileDomain[] = [];
  if (skills.some(s => s.category === "framework")) {
    domains.push({
      name: "Web Development",
      confidence: "observed",
      evidence: projects.map(p => p.fullName),
    });
  }

  return {
    profileId: makeProfileId(source.login),
    login: source.login,
    displayName: source.name,
    bio: source.bio,
    location: source.location,
    skills,
    projects,
    timeline,
    domains,
    strongestSignal: skills.length > 0 ? {
      text: `${source.login} has strong expertise in ${skills[0].name}`,
      truthStatus: "verified",
      evidence: skills[0].evidence,
      isHypothesis: false,
    } : null,
    contradictions: [],
    hypotheses: [],
    source,
    createdAt: new Date().toISOString(),
  };
}
