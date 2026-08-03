import { NextRequest, NextResponse } from "next/server";
import { refuseOutsideHomelab } from "@/lib/profile/guards";
import { openStore } from "@/lib/store/factory";
import { loadDecisions } from "@/lib/corpus/persistence";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const repo = req.nextUrl.searchParams.get("repo") ?? undefined;
  // Homelab-Route: in einem flüchtigen Profil gibt es keinen Store.
  const notHere = refuseOutsideHomelab();
  if (notHere) return notHere;

  const store = await openStore({ kind: "sqlite" });
  try {
    const decisions = await loadDecisions(store, repo);
    decisions.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json({ decisions, total: decisions.length });
  } finally {
    store.close();
  }
}
