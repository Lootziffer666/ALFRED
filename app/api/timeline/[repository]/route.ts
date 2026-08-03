import { NextRequest, NextResponse } from "next/server";
import { openStore } from "@/lib/store/factory";
import { loadTimeline } from "@/lib/timeline/persistence";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ repository: string }> },
): Promise<NextResponse> {
  const store = await openStore({ kind: "sqlite" });
  try {
    const repo = decodeURIComponent((await params).repository);
    const snapshots = await loadTimeline(store, repo);
    return NextResponse.json({ repository: repo, snapshots, total: snapshots.length });
  } finally {
    store.close();
  }
}
