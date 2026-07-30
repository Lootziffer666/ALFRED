import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchRepoEvidence, GitHubInputError, normalizeRepoInput } from "@/lib/github";

const bodySchema = z.object({
  repo: z.string().min(1),
  ref: z.string().optional(),
  token: z.string().optional(),
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

  try {
    const { owner, name } = normalizeRepoInput(parsed.data.repo);
    const evidence = await fetchRepoEvidence({
      owner,
      name,
      ref: parsed.data.ref,
      token: parsed.data.token,
    });
    return NextResponse.json({ evidence });
  } catch (err) {
    if (err instanceof GitHubInputError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json({ error: `Unexpected error while inspecting the repository: ${(err as Error).message}` }, { status: 500 });
  }
}
