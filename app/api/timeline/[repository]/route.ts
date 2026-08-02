import { NextRequest, NextResponse } from "next/server";
import { openStore } from "../../../../lib/store/factory.js";
import { loadTimeline } from "../../../../lib/timeline/persistence.js";

export async function GET(
  _req: NextRequest,
  { params }: { params: { repository: string } },
): Promise<NextResponse> {
  const store = await openStore({ kind: "sqlite" });
  try {
    const repo = decodeURIComponent(params.repository);
    const snapshots = await loadTimeline(store, repo);
    return NextResponse.json({ repository: repo, snapshots, total: snapshots.length });
  } finally {
    store.close();
  }
}
