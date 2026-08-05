// Stage 3 — Suchendpunkt. Folgt dem Muster von app/api/scout/route.ts.

import { NextRequest, NextResponse } from "next/server";
import { refuseOutsideHomelab } from "@/lib/profile/guards";
import { openStore } from "@/lib/store/factory";
import { buildSearchIndex } from "@/lib/search/index-source";
import { parseSearchQuery, applyFilters } from "@/lib/search/query";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const repoFilter = req.nextUrl.searchParams.get("repo") ?? undefined;

  // Homelab-Route: in einem flüchtigen Profil gibt es keinen Store.
  const notHere = refuseOutsideHomelab();
  if (notHere) return notHere;

  const store = await openStore({ kind: "sqlite" });

  try {
    const index = await buildSearchIndex(store, repoFilter);
    const parsed = parseSearchQuery(q);

    let results = index;

    // Text-Filter
    if (parsed.text) {
      const lower = parsed.text.toLowerCase();
      results = results.filter(
        (r) =>
          r.title.toLowerCase().includes(lower) ||
          r.detail.toLowerCase().includes(lower) ||
          r.path?.toLowerCase().includes(lower),
      );
    }

    // Key:value-Filter
    if (Object.keys(parsed.filters || {}).length > 0) {
      results = applyFilters(results, parsed.filters || {});
    }

    // Neueste zuerst
    results.sort((a, b) => b.observedAt.localeCompare(a.observedAt));

    return NextResponse.json({ results, total: results.length });
  } finally {
    store.close();
  }
}
