import { NextResponse } from "next/server";
import { z } from "zod";
import { scout } from "@/lib/homelab/scout";

/**
 * External alternatives search. Everything it returns is `external` and
 * `unverified` by construction — this route finds candidates, it never adopts
 * one.
 */

const bodySchema = z.object({
  need: z.object({ capabilityId: z.string().min(1), label: z.string().min(2) }),
  stack: z.array(z.string()).default([]),
  licenseRequirement: z.enum(["permissive", "any-open", "any"]).default("permissive"),
  keywords: z.array(z.string()).optional(),
  token: z.string().optional(),
  limit: z.number().int().min(1).max(20).optional(),
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
    const result = await scout(
      {
        need: parsed.data.need,
        stack: parsed.data.stack,
        licenseRequirement: parsed.data.licenseRequirement,
        keywords: parsed.data.keywords,
      },
      { token: parsed.data.token, perPage: parsed.data.limit ?? 10 },
    );
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: `Unerwarteter Fehler bei der Suche: ${(err as Error).message}` },
      { status: 500 },
    );
  }
}
