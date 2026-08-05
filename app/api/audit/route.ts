import { NextResponse } from "next/server";
import { refuseForeignCredentials } from "@/lib/profile/guards";
import { z } from "zod";
import { handoffSchema } from "@/lib/schema";
import { fetchCompareFiles, fetchPullRequestFiles, parseGitHubResourceUrl, parseUnifiedDiff } from "@/lib/github";
import { buildAcceptanceReport } from "@/lib/audit";
import type { ChangedFile, SubmittedChangeSource } from "@/lib/schema";

const bodySchema = z.object({
  handoff: handoffSchema,
  input: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("url"), url: z.string().url() }),
    z.object({ kind: z.literal("pasted_diff"), diff: z.string().min(1) }),
  ]),
  token: z.string().optional(),
  agentSummary: z.string().optional(),
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

  // Zugangsdaten nur, wo Betreiber und Besitzer dieselbe Person sind.
  const refusal = refuseForeignCredentials([parsed.data.token]);
  if (refusal) return refusal;

  const { handoff, input, token, agentSummary } = parsed.data;

  let changedFiles: ChangedFile[];
  let source: SubmittedChangeSource;

  if (input.kind === "pasted_diff") {
    changedFiles = parseUnifiedDiff(input.diff);
    source = { kind: "pasted_diff", diff: input.diff };
    if (changedFiles.length === 0) {
      return NextResponse.json({ error: "No file changes could be parsed from the pasted diff." }, { status: 422 });
    }
  } else {
    const resource = parseGitHubResourceUrl(input.url);
    if (resource.kind === "invalid") {
      return NextResponse.json({ error: resource.reason }, { status: 422 });
    }
    if (resource.kind === "pull_request") {
      const result = await fetchPullRequestFiles(resource.owner, resource.name, resource.number, token);
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: 502 });
      changedFiles = result.files;
      source = { kind: "pull_request", url: input.url };
    } else {
      const result = await fetchCompareFiles(resource.owner, resource.name, resource.base, resource.head, token);
      if ("error" in result) return NextResponse.json({ error: result.error }, { status: 502 });
      changedFiles = result.files;
      source = { kind: "compare", url: input.url };
    }
  }

  const report = buildAcceptanceReport({ handoff, changedFiles, source, agentSummary });
  return NextResponse.json({ report });
}
