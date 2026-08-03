import { NextRequest, NextResponse } from "next/server";
import { refuseOutsideHomelab } from "@/lib/profile/guards";
import { openStore } from "@/lib/store/factory";
import { loadTimeline } from "@/lib/timeline/persistence";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ repository: string }> },
): Promise<NextResponse> {
  // Homelab-Route: in einem flüchtigen Profil gibt es keinen Store.
  const notHere = refuseOutsideHomelab();
  if (notHere) return notHere;

  const store = await openStore({ kind: "sqlite" });
  try {
    const repo = decodeURIComponent((await params).repository);
    const snapshots = await loadTimeline(store, repo);
    return NextResponse.json({ repository: repo, snapshots, total: snapshots.length });
  } finally {
    store.close();
  }
}
