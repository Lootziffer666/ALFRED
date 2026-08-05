import { NextResponse } from "next/server";
import { refuseForeignCredentials } from "@/lib/profile/guards";
import { z } from "zod";
import { HuggingFaceError, findCandidates } from "@/lib/homelab/huggingface";

/**
 * Model catalogue search. Reads public Hugging Face repositories; a token is
 * accepted only so a user can look at their own gated repositories, and is
 * never stored.
 */

const bodySchema = z.object({
  query: z.string().min(2),
  limit: z.number().int().min(1).max(20).optional(),
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

  // Zugangsdaten nur, wo Betreiber und Besitzer dieselbe Person sind.
  const refusal = refuseForeignCredentials([parsed.data.token]);
  if (refusal) return refusal;

  try {
    const { candidates, skipped } = await findCandidates({
      query: parsed.data.query,
      limit: parsed.data.limit ?? 5,
      token: parsed.data.token,
    });
    return NextResponse.json({ candidates, skipped });
  } catch (err) {
    if (err instanceof HuggingFaceError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json(
      { error: `Unerwarteter Fehler bei der Modellsuche: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
