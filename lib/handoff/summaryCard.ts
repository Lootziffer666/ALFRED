// plan §34 — Summary Card: Kompakte Übersicht für Übergabe.

export interface SummaryCard {
  title: string;
  status: "healthy" | "warning" | "critical";
  items: Array<{ label: string; value: string }>;
}

export function createSummaryCard(title: string): SummaryCard {
  return {
    title,
    status: "healthy",
    items: [],
  };
}

export function addCardItem(
  card: SummaryCard,
  label: string,
  value: string,
): void {
  card.items.push({ label, value });
}
