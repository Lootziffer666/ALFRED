// plan §31 — Skill File Writer. Generiert Platzhalter-Skill-Struktur.

export interface SkillTemplate {
  name: string;
  description: string;
}

export function generateSkillBoilerplate(template: SkillTemplate): string {
  return `// ${template.name} — ${template.description}
// plan §31 — Custom Job Skill

export const job = {
  name: "${template.name}",

  async run(jc) {
    return { status: "ok", findings: [], writes: [] };
  },
};
`;
}
