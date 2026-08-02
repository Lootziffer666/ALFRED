import { NextRequest, NextResponse } from "next/server";
import { openStore } from "../../../../lib/store/factory.js";
import { buildEvidenceChain } from "../../../../lib/evidence/assemble.js";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const store = await openStore({ kind: "sqlite" });
  try {
    const chain = await buildEvidenceChain(store, params.id);
    if (!chain) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(chain);
  } finally {
    store.close();
  }
}
