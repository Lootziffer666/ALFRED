// Stage 3 — Suchendpunkt. Folgt dem Muster von app/api/scout/route.ts.

import { NextRequest, NextResponse } from "next/server";
import { openStore } from "../../../lib/store/factory.js";
import { buildSearchIndex } from "../../../lib/search/index-source.js";
import { parseSearchQuery, applyFilters } from "../../../lib/search/query.js";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const repoFilter = req.nextUrl.searchParams.get("repo") ?? undefined;

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
