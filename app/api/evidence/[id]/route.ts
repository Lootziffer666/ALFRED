import { NextRequest, NextResponse } from "next/server";
import { refuseOutsideHomelab } from "@/lib/profile/guards";
import { openStore } from "@/lib/store/factory";
import { buildEvidenceChain } from "@/lib/evidence/assemble";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // Homelab-Route: in einem flüchtigen Profil gibt es keinen Store.
  const notHere = refuseOutsideHomelab();
  if (notHere) return notHere;

  const { id } = await params;
  const store = await openStore({ kind: "sqlite" });
  try {
    const chain = await buildEvidenceChain(store, id);
    if (!chain) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(chain);
  } finally {
    store.close();
  }
}
