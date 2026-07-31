import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchRepoEvidence, GitHubInputError, normalizeRepoInput } from "@/lib/github";
import { extract } from "@/lib/atoms/extract";
import { composeReport } from "@/lib/report/compose";
import { signalsFromEvidence } from "@/lib/report/signals";
import { REPORT_MODES, isReportMode } from "@/lib/report/modes";

/**
 * The public demo's report route. It takes no credentials by construction:
 * the public profile reads public repositories only (plan §7.1), and it
 * composes deterministically — no model is involved (plan §8.7).
 */

const bodySchema = z.object({
  repo: z.string().min(1),
  ref: z.string().optional(),
  mode: z.string().optional(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  }

  const requestedMode = parsed.data.mode ?? "pruefbericht";
  if (!isReportMode(requestedMode)) {
    return NextResponse.json({ error: `Unknown report mode "${requestedMode}".` }, { status: 400 });
  }
  const modeSpec = REPORT_MODES[requestedMode];
  if (modeSpec.status !== "implemented") {
    return NextResponse.json(
      { error: `The "${modeSpec.label}" mode is planned but not implemented yet.` },
      { status: 422 },
    );
  }

  try {
    const { owner, name } = normalizeRepoInput(parsed.data.repo);
    const evidence = await fetchRepoEvidence({ owner, name, ref: parsed.data.ref });

    if (evidence.identity.private) {
      return NextResponse.json(
        { error: "The public demo reads public repositories only." },
        { status: 422 },
      );
    }

    const { signals, sources } = signalsFromEvidence(evidence);
    const atoms = extract(signals);
    const report = composeReport(requestedMode, {
      atoms,
      signals,
      level: parsed.data.level ?? modeSpec.defaultLevel,
      repo: { owner, name, ref: evidence.identity.ref },
    });

    return NextResponse.json({
      report,
      repo: evidence.identity,
      sources,
      warnings: evidence.warnings,
      fetchedAt: evidence.fetchedAt,
    });
  } catch (err) {
    if (err instanceof GitHubInputError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: `Unexpected error while building the report: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
