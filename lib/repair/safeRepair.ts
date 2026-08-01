// plan §34 — Safe Repair: Reparaturen mit Rollback-Plan.

export interface RepairRequest {
  kind: string;
  findingId: string;
  dryRun?: boolean;
}

export interface RepairResult {
  ok: boolean;
  message: string;
  rollbackPlan?: string;
}

export async function executeRepair(
  _req: RepairRequest,
): Promise<RepairResult> {
  return {
    ok: false,
    message: "Repair not implemented",
  };
}

export function validateRepair(_req: RepairRequest): boolean {
  return false;
}
