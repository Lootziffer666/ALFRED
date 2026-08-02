import { NextRequest, NextResponse } from "next/server";
import { openStore } from "../../../lib/store/factory.js";
import { collectAttentionItems } from "../../../lib/butler-post/index.js";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const repo = req.nextUrl.searchParams.get("repo") ?? undefined;
  const store = await openStore({ kind: "sqlite" });
  try {
    const items = await collectAttentionItems(store, repo);
    return NextResponse.json({ items, total: items.length });
  } finally {
    store.close();
  }
}
