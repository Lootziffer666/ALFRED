import { NextResponse } from "next/server";
import { refuseForeignCredentials } from "@/lib/profile/credentialGuard";
import { z } from "zod";
import { repoEvidenceSchema } from "@/lib/schema";
import { generateContractMap } from "@/lib/contractMap";

const bodySchema = z.object({
  evidence: repoEvidenceSchema,
  apiKey: z.string().min(1),
  model: z.string().min(1),
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
  const refusal = refuseForeignCredentials([parsed.data.apiKey]);
  if (refusal) return refusal;

  const result = await generateContractMap(parsed.data.evidence, {
    apiKey: parsed.data.apiKey,
    model: parsed.data.model,
  });

  if (!result.ok) {
    const status = result.kind === "provider" ? 502 : 422;
    return NextResponse.json({ error: result.reason, raw: "raw" in result ? result.raw : undefined }, { status });
  }

  return NextResponse.json({ contractMap: result.contractMap });
}
