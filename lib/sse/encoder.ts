/**
 * SSE-Encoder (Etappe 13a).
 *
 * Serialisiert SseEvent-Objekte in das RFC 8895 Text-Event-Stream-Format:
 *
 *   id: <id>\n
 *   event: <kind>\n
 *   data: <JSON>\n
 *   \n
 *
 * Reines Utility — keine I/O.
 */

import type { SseEvent } from "./types";

export function encodeSseEvent(event: SseEvent): string {
  const lines: string[] = [];
  lines.push(`id: ${event.id}`);
  lines.push(`event: ${event.kind}`);
  // data-Zeilen dürfen keine \n enthalten — JSON auf eine Zeile
  lines.push(`data: ${JSON.stringify(event.payload)}`);
  lines.push(""); // Leerzeile = End-of-Event
  return lines.join("\n") + "\n";
}

export function encodePing(serverTime: string): string {
  return `event: ping\ndata: ${JSON.stringify({ serverTime })}\n\n`;
}

export function encodeRetry(ms: number): string {
  return `retry: ${ms}\n\n`;
}
