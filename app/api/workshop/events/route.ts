/**
 * GET /api/workshop/events
 *
 * SSE-Endpunkt für Raum IX · Werkstatt (Etappe 13b).
 *
 * Clients verbinden sich einmal und erhalten danach Live-Updates
 * für Orders, Sessions, Heartbeats, CUE-Berichte und Supervisor-Ticks.
 *
 * Query-Parameter:
 *   filter   — Komma-separierte Liste von SseEventKind (optional)
 *              Beispiel: ?filter=order-update,heartbeat
 *
 * Headers:
 *   Last-Event-ID — Letztes empfangenes Event-ID für Reconnect-Resume
 *
 * Rate-Limit: via Edge-Middleware (Etappe 12).
 * Operating Profile: via X-Alfret-Profile-Header.
 */

import type { NextRequest } from "next/server";
import { broadcaster } from "@/lib/sse/broadcaster";
import type { SseEventKind } from "@/lib/sse/types";

export const runtime = "nodejs"; // SSE braucht Node.js-Runtime, nicht Edge

const ALLOWED_FILTER_KINDS = new Set<SseEventKind>([
  "order-update",
  "session-update",
  "heartbeat",
  "cue-report",
  "maid-report",
  "supervisor-tick",
  "demo-result",
  "ping",
]);

function parseFilter(raw: string | null): SseEventKind[] | null {
  if (!raw) return null;
  const kinds = raw
    .split(",")
    .map((k) => k.trim() as SseEventKind)
    .filter((k) => ALLOWED_FILTER_KINDS.has(k));
  return kinds.length > 0 ? kinds : null;
}

export async function GET(req: NextRequest) {
  const filterParam = req.nextUrl.searchParams.get("filter");
  const lastEventId = req.headers.get("last-event-id");
  const filter = parseFilter(filterParam);

  const { stream } = broadcaster.subscribe(filter, lastEventId);

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no", // Nginx-Buffering deaktivieren
    },
  });
}
