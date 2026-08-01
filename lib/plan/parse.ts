// plan §30 — PLAN.md Parser. Abschnittsbeginn "§N" bestimmt Sektions-ID.
// text[] = alle Zeilen bis zum nächsten §. Modul ist rein, keine I/O.

export interface PlanSection {
  number: number;
  heading: string;
  lines: string[];
}

export interface ParsedPlan {
  sections: Map<number, PlanSection>;
}

export function parsePlan(content: string): ParsedPlan {
  const sections = new Map<number, PlanSection>();
  const lines = content.split("\n");

  let currentSection: PlanSection | null = null;

  for (const line of lines) {
    // Suche nach "§N" am Anfang einer Zeile oder nach #
    const match = line.match(/^#+\s*§(\d+)(?:\s+—\s+(.*))?/);

    if (match) {
      if (currentSection) {
        sections.set(currentSection.number, currentSection);
      }

      currentSection = {
        number: Number(match[1]),
        heading: match[2] || "",
        lines: [],
      };
    } else if (currentSection) {
      currentSection.lines.push(line);
    }
  }

  if (currentSection) {
    sections.set(currentSection.number, currentSection);
  }

  return { sections };
}

export function getSectionCount(parsed: ParsedPlan): number {
  return parsed.sections.size;
}

export function getSection(
  parsed: ParsedPlan,
  number: number,
): PlanSection | undefined {
  return parsed.sections.get(number);
}
