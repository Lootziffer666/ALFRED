/**
 * Export-Typen (Etappe 14b).
 *
 * DeveloperProfile in verschiedene Formate transformieren ohne Fakten zu ändern.
 */

import type { DeveloperProfile } from "../types";

export type ExportFormat = "markdown" | "text" | "json";

export interface ExportConfig {
  format: ExportFormat;
  includeEvidence?: boolean;
  includeHypotheses?: boolean;
  includeLinks?: boolean;
}

export interface ExportResult {
  format: ExportFormat;
  content: string;
  charCount: number;
  lineCount: number;
}

export function exportProfile(
  profile: DeveloperProfile,
  config: ExportConfig
): ExportResult {
  let content: string;

  if (config.format === "json") {
    content = JSON.stringify(profile, null, 2);
  } else if (config.format === "text") {
    content = exportAsText(profile, config);
  } else {
    content = exportAsMarkdown(profile, config);
  }

  const lines = content.split("\n").length;

  return {
    format: config.format,
    content,
    charCount: content.length,
    lineCount: lines,
  };
}

function exportAsText(profile: DeveloperProfile, config: ExportConfig): string {
  const lines: string[] = [];

  lines.push(`${profile.displayName || profile.login}`);
  lines.push("");

  if (profile.bio) {
    lines.push(profile.bio);
    lines.push("");
  }

  if (profile.location || profile.source.company) {
    if (profile.location) lines.push(`Location: ${profile.location}`);
    if (profile.source.company) lines.push(`Company: ${profile.source.company}`);
    lines.push("");
  }

  lines.push("SKILLS");
  for (const skill of profile.skills.slice(0, 15)) {
    const share = skill.codeShare ? ` (${Math.round(skill.codeShare * 100)}%)` : "";
    lines.push(`- ${skill.name} [${skill.category}]${share}`);
  }
  lines.push("");

  if (profile.projects.length > 0) {
    lines.push("NOTABLE PROJECTS");
    for (const proj of profile.projects.slice(0, 5)) {
      lines.push(proj.repoName);
      lines.push(proj.headline);
      lines.push("");
    }
  }

  return lines.join("\n");
}

function exportAsMarkdown(profile: DeveloperProfile, config: ExportConfig): string {
  const lines: string[] = [];

  lines.push(`# ${profile.displayName || profile.login}`);
  lines.push("");

  if (profile.bio) {
    lines.push(`> ${profile.bio}`);
    lines.push("");
  }

  if (profile.location || profile.source.company) {
    lines.push("**Details**");
    if (profile.location) lines.push(`- Location: ${profile.location}`);
    if (profile.source.company) lines.push(`- Company: ${profile.source.company}`);
    lines.push("");
  }

  lines.push("## Skills");
  for (const skill of profile.skills.slice(0, 15)) {
    const share = skill.codeShare ? ` (${Math.round(skill.codeShare * 100)}%)` : "";
    lines.push(`- **${skill.name}** \`${skill.category}\`${share}`);
  }
  lines.push("");

  if (profile.projects.length > 0) {
    lines.push("## Notable Projects");
    for (const proj of profile.projects.slice(0, 5)) {
      lines.push(`### ${proj.repoName}`);
      lines.push(proj.headline);
      lines.push("");
    }
  }

  return lines.join("\n");
}
