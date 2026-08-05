// plan §31 — Skill-Selection: Welche Custom Jobs soll ein Repo laden?

export interface SkillManifest {
  name: string;
  description: string;
  triggers: Array<"readme-freshness" | "maid-scan">;
  jobFile: string;
}

export interface SkillsConfig {
  skills?: string[];
}

export function selectSkillsForRepo(
  repoPath: string,
  config: SkillsConfig,
): string[] {
  return config.skills ?? [];
}

export async function loadSkillManifest(
  _skillPath: string,
): Promise<SkillManifest> {
  const manifest: SkillManifest = {
    name: "unknown",
    description: "",
    triggers: [],
    jobFile: "",
  };
  return manifest;
}
