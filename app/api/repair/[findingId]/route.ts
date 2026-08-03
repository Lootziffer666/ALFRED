import { NextRequest, NextResponse } from "next/server";
import { openStore } from "@/lib/store/factory";
import { validateRepair, executeRepair } from "@/lib/repair/safeRepair";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ findingId: string }> },
): Promise<NextResponse> {
  const { findingId } = await params;
  const store = await openStore({ kind: "sqlite" });
  try {
    const result = await validateRepair(store, findingId);
    return NextResponse.json(result);
  } finally {
    store.close();
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ findingId: string }> },
): Promise<NextResponse> {
  const { findingId } = await params;
  const token = process.env.ALFRET_GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Kein GitHub-Token konfiguriert." }, { status: 500 });
  }

  const store = await openStore({ kind: "sqlite" });
  try {
    const result = await executeRepair(store, findingId, token);

    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 422 });
    }

    // Writes als pending-approval loggen — kein armed-Check nötig, da Stage 4
    // den executeWrite-Aufruf noch hinter armed: true gateted
    const { logPlannedWrite } = await import("@/lib/daemon/writes-log");
    for (let i = 0; i < result.writes.length; i++) {
      await logPlannedWrite(store, {
        write: result.writes[i],
        tickId: `repair:${findingId}`,
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
