import { NextRequest, NextResponse } from "next/server";
import { refuseOutsideHomelab } from "@/lib/profile/guards";
import { openStore } from "@/lib/store/factory";
import { collectAttentionItems } from "@/lib/butler-post";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const repo = req.nextUrl.searchParams.get("repo") ?? undefined;
  // Homelab-Route: in einem flüchtigen Profil gibt es keinen Store.
  const notHere = refuseOutsideHomelab();
  if (notHere) return notHere;

  const store = await openStore({ kind: "sqlite" });
  try {
    const items = await collectAttentionItems(store, repo);
    return NextResponse.json({ items, total: items.length });
  } finally {
    store.close();
  }
}
