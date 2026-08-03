// ACHTUNG — DATENHOHEIT: Dies ist der einzige Modellpfad im Repo mit einem
// fest verdrahteten Cloud-Endpoint. Wer generateContractMap() aufruft, schickt
// README-Auszüge, Commit-Nachrichten und PR-Titel des untersuchten
// Repositories an openrouter.ai.
//
// Das Skriptorium (components/archive/useArchive.ts) macht es anders: dort ist
// der Endpoint ein Freitextfeld, und ein lokales Modell (Ollama, llama.cpp)
// erfüllt denselben Zweck, ohne dass etwas den Rechner verlässt.
//
// Diese Datei kann das noch nicht. Sie ist bewusst dünn und modellagnostisch
// (PRD §5.4/§9) — nur die URL ist es nicht. Solange das so bleibt, gilt:
// /api/contract-map ist ein Cloud-Pfad, und der Credential-Guard
// (lib/profile/guards.ts) lässt ihn nur dort zu, wo Betreiber und
// Schlüsselbesitzer dieselbe Person sind.
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterCallParams {
  apiKey: string;
  model: string;
  messages: OpenRouterMessage[];
  /** Ask the model to emit a single JSON object. */
  jsonMode?: boolean;
  temperature?: number;
}

export type OpenRouterResult =
  | { ok: true; content: string; modelId: string }
  | { ok: false; kind: "auth" | "rate_limited" | "invalid_response" | "network"; reason: string };

/**
 * Thin, isolated adapter around OpenRouter's OpenAI-compatible chat-completions
 * endpoint. The product must stay swappable across models (PRD §5.4 / §9), so
 * nothing here is model-specific.
 */
export async function callOpenRouter(params: OpenRouterCallParams): Promise<OpenRouterResult> {
  const { apiKey, model, messages, jsonMode, temperature = 0.2 } = params;

  if (!apiKey.trim()) {
    return { ok: false, kind: "auth", reason: "No OpenRouter API key was provided." };
  }
  if (!model.trim()) {
    return { ok: false, kind: "auth", reason: "No OpenRouter model identifier was provided." };
  }

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://alfret.local",
        "X-Title": "ALFRET",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
    });
  } catch (err) {
    return { ok: false, kind: "network", reason: `Network error contacting OpenRouter: ${(err as Error).message}` };
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, kind: "auth", reason: "OpenRouter rejected the API key." };
  }
  if (res.status === 429) {
    return { ok: false, kind: "rate_limited", reason: "OpenRouter rate limit reached. Try again shortly." };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, kind: "network", reason: `OpenRouter responded with HTTP ${res.status}. ${body.slice(0, 300)}` };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, kind: "invalid_response", reason: "OpenRouter response was not valid JSON." };
  }

  const content = extractContent(json);
  if (content === null) {
    return { ok: false, kind: "invalid_response", reason: "OpenRouter response did not contain a message." };
  }

  return { ok: true, content, modelId: model };
}

function extractContent(json: unknown): string | null {
  if (typeof json !== "object" || json === null) return null;
  const choices = (json as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content : null;
}

/** Best-effort extraction of a JSON object from a possibly fenced/prose-wrapped model reply. */
export function extractJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new SyntaxError("No JSON object found in model response.");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}
