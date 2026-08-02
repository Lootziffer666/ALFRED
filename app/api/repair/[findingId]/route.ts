import { NextRequest, NextResponse } from "next/server";
import { openStore } from "../../../../lib/store/factory.js";
import { validateRepair, executeRepair } from "../../../../lib/repair/safeRepair.js";

export async function GET(
  _req: NextRequest,
  { params }: { params: { findingId: string } },
): Promise<NextResponse> {
  const store = await openStore({ kind: "sqlite" });
  try {
    const result = await validateRepair(store, params.findingId);
    return NextResponse.json(result);
  } finally {
    store.close();
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { findingId: string } },
): Promise<NextResponse> {
  const token = process.env.ALFRET_GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Kein GitHub-Token konfiguriert." }, { status: 500 });
  }

  const store = await openStore({ kind: "sqlite" });
  try {
    const result = await executeRepair(store, params.findingId, token);

    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 422 });
    }

    // Writes als pending-approval loggen — kein armed-Check nötig, da Stage 4
    // den executeWrite-Aufruf noch hinter armed: true gateted
    const { logPlannedWrite } = await import("../../../../lib/daemon/writes-log.js");
    for (let i = 0; i < result.writes.length; i++) {
      await logPlannedWrite(store, {
        write: result.writes[i],
        tickId: `repair:${params.findingId}`,
        jobName: "manual-repair",
        index: i,
        status: "pending-approval",
      });
    }

    return NextResponse.json({ ok: true, writes: result.writes });
  } finally {
    store.close();
  }
}
