/**
 * Developer-Profil-Typen (Etappe 14a).
 *
 * ALFRET analysiert den öffentlichen GitHub-Footprint eines Nutzers
 * und erzeugt daraus ein evidenzbasiertes Developer-Profil.
 */

import type { TruthStatus } from "@/lib/schema/truth";
import type { DetailedEvidenceRef } from "@/lib/schema/common";

// ── Profil-Quellen ──────────────────────────────────────────────────────────

export interface ProfileRepo {
  name: string;
  fullName: string;
  description: string | null;
  url: string;
  language: string | null;
  languages: Record<string, number>;
  topics: string[];
  stars: number;
  forks: number;
  isForked: boolean;
  isMirror: boolean;
  hasReleases: boolean;
  latestRelease: string | null;
  defaultBranch: string;
  pushedAt: string;
  createdAt: string;
  commitCount: number | null;
  readmeSummary: string | null;
}

export interface ProfileSource {
  login: string;
  name: string | null;
  bio: string | null;
  location: string | null;
  company: string | null;
  blog: string | null;
  twitterUsername: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  createdAt: string;
  repos: ProfileRepo[];
  fetchedAt: string;
}

// ── Profil-Erkenntnisse ─────────────────────────────────────────────────────

export type SkillConfidence = "verified" | "observed" | "declared" | "not-proven";

export interface ProfileSkill {
  name: string;
  category: SkillCategory;
  confidence: SkillConfidence;
  truthStatus: TruthStatus;
  evidence: DetailedEvidenceRef[];
  codeShare: number | null;
  repoCount: number;
  primaryRepo: string | null;
}

export type SkillCategory =
  | "language"
  | "framework"
  | "runtime"
  | "infrastructure"
  | "database"
  | "tooling"
  | "domain";

export interface ProfileProject {
  repoName: string;
  fullName: string;
  url: string;
  headline: string;
  role: ProjectRole;
  truthStatus: TruthStatus;
  usageSignals: UsageSignal[];
  languages: string[];
  topics: string[];
  hasRelease: boolean;
  isOriginal: boolean;
  evidence: DetailedEvidenceRef[];
}

export type ProjectRole = "author" | "maintainer" | "contributor" | "forked" | "mirror";

export interface UsageSignal {
  kind: "stars" | "forks" | "release" | "topics" | "readme-quality" | "commit-frequency";
  value: string | number;
  note: string;
}

export interface ProfileTimeline {
  firstRepoAt: string | null;
  peakYear: number | null;
  languageEvolution: LanguageEpoch[];
  phases: CareerPhase[];
}

export interface LanguageEpoch {
  year: number;
  topLanguage: string;
  repoCount: number;
}

export interface CareerPhase {
  label: string;
  fromYear: number;
  toYear: number | null;
  characterization: string;
  truthStatus: TruthStatus;
}

// ── Das Profil ─────────────────────────────────────────────────────────────

export interface DeveloperProfile {
  profileId: string;
  login: string;
  displayName: string | null;
  bio: string | null;
  location: string | null;
  skills: ProfileSkill[];
  projects: ProfileProject[];
  timeline: ProfileTimeline;
  domains: ProfileDomain[];
  strongestSignal: EvidenceStatement | null;
  contradictions: EvidenceStatement[];
  hypotheses: EvidenceStatement[];
  source: ProfileSource;
  createdAt: string;
}

export interface ProfileDomain {
  name: string;
  confidence: SkillConfidence;
  evidence: string[];
}

export interface EvidenceStatement {
  text: string;
  truthStatus: TruthStatus;
  evidence: DetailedEvidenceRef[];
  isHypothesis: boolean;
}
