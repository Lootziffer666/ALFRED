// CUE-Persistenz — Stage 0, Phase 2.
// Entity-Wrapper um CueReport.

import type { AlfretStore } from "../store/types.js";
import type { CueReport } from "./types.js";

export interface StoredCueReport extends CueReport {
  kind: "cue-report";
  id: string; // = reportId
}

export async function saveCueReport(
  store: AlfretStore,
  report: CueReport,
): Promise<void> {
  const entity: StoredCueReport = {
    ...report,
    kind: "cue-report",
    id: report.reportId,
  };
  await store.put(entity);
}

export async function getCueReport(
  store: AlfretStore,
  reportId: string,
): Promise<CueReport | undefined> {
  const entity = await store.get<StoredCueReport>("cue-report", reportId);
  if (!entity) return undefined;
  const { kind: _k, id: _i, ...report } = entity;
  return report as CueReport;
}

export async function listCueReports(
  store: AlfretStore,
  taskId?: string,
): Promise<CueReport[]> {
  const all = await store.list<StoredCueReport>("cue-report");
  const filtered = taskId ? all.filter((e) => e.taskId === taskId) : all;
  return filtered.map(({ kind: _k, id: _i, ...r }) => r as CueReport);
}
