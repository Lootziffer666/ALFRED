// plan §36 — Schreibbudget im Executor. Ein durchgedrehter Job soll fünf Fehler
// produzieren, nicht fünfhundert — das Budget ist eine Schadensbegrenzung, keine Optimierung.

export interface WriteBudget {
  maxWritesPerTick: number; // 5
  maxPrsPerRepoPerDay: number; // 3
}

export const DEFAULT_WRITE_BUDGET: WriteBudget = {
  maxWritesPerTick: 5,
  maxPrsPerRepoPerDay: 3,
};

export interface BudgetState {
  writesThisTick: number;
  prsToday: Map<string, { date: string; count: number }>;
}

export function canWrite(state: BudgetState, budget: WriteBudget): boolean {
  return state.writesThisTick < budget.maxWritesPerTick;
}

export function canOpenPr(
  state: BudgetState,
  budget: WriteBudget,
  repository: string,
  today: string,
): boolean {
  const entry = state.prsToday.get(repository);

  if (!entry || entry.date !== today) return true;

  return entry.count < budget.maxPrsPerRepoPerDay;
}
