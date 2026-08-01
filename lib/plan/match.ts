// plan §30 — Etappe-Referenzen im Code prüfen: findPlanReferences, verifyReferences.

export interface PlanReference {
  file: string;
  line: number;
  number: number;
  context: string;
}

export interface VerifyResult {
  valid: boolean;
  missing: PlanReference[];
  valid_refs: PlanReference[];
}

export function findPlanReferences(content: string, file: string): PlanReference[] {
  const references: PlanReference[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match "plan §N" pattern
    const matches = [...line.matchAll(/plan\s+§(\d+)/g)];

    for (const match of matches) {
      references.push({
        file,
        line: i + 1,
        number: Number(match[1]),
        context: line.trim(),
      });
    }
  }

  return references;
}

export function verifyReferences(
  references: PlanReference[],
  declaredSections: Set<number>,
): VerifyResult {
  const valid_refs: PlanReference[] = [];
  const missing: PlanReference[] = [];

  for (const ref of references) {
    if (declaredSections.has(ref.number)) {
      valid_refs.push(ref);
    } else {
      missing.push(ref);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
    valid_refs,
  };
}
