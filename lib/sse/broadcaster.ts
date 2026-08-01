/**
 * SSE-Broadcaster (Etappe 13a).
 *
 * Verwaltet eine Menge aktiver SSE-Verbindungen und broadcastet
 * Events an alle oder gefilterte Subscriber.
 *
 * Bewusst einfach: In-process, kein Redis, kein Pub/Sub.
 * Für die Demo und lokale Installation vollständig ausreichend.
 * Skaliert nicht horizontal — das ist bekannt und akzeptiert.
 *
 * Jede Verbindung bekommt eine ReadableStream-Instanz.
 * Der Broadcaster hält starke Referenzen auf die Controller.
 */

import { encodeSseEvent, encodePing, encodeRetry } from "./encoder";
import type { SseEvent, SseEventKind } from "./types";

// ── Subscriber ────────────────────────────────────────────────────────────

interface Subscriber {
  id: string;
  /** Optionaler Filter — null = alle Events. */
  filter: SseEventKind[] | null;
  controller: ReadableStreamDefaultController<Uint8Array>;
  connectedAt: string;
  lastEventId: string | null;
}

let nextEventId = 1;
let nextSubscriberId = 1;

function makeEventId(): string {
  return String(nextEventId++);
}

const encoder = new TextEncoder();

// ── Broadcaster ───────────────────────────────────────────────────────────

class SseBroadcaster {
  private subscribers = new Map<string, Subscriber>();
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Keep-alive-Ping alle 15 Sekunden
    this.pingInterval = setInterval(() => {
      this.ping();
    }, 15_000);
  }

  /**
   * Erstellt eine neue SSE-Verbindung und gibt den ReadableStream zurück.
   * Der Caller ist verantwortlich dafür, den Stream als Response-Body zu senden.
   */
  subscribe(
    filter: SseEventKind[] | null = null,
    lastEventId: string | null = null,
  ): { stream: ReadableStream<Uint8Array>; subscriberId: string } {
    const subscriberId = `sub-${nextSubscriberId++}`;

    const stream = new ReadableStream<Uint8Array>({
      start: (controller) => {
        const sub: Subscriber = {
          id: subscriberId,
          filter,
          controller,
          connectedAt: new Date().toISOString(),
          lastEventId,
        };

        this.subscribers.set(subscriberId, sub);

        // Retry-Hint: Browser soll nach 3s reconnecten
        controller.enqueue(encoder.encode(encodeRetry(3_000)));
      },

      cancel: () => {
        this.subscribers.delete(subscriberId);
      },
    });

    return { stream, subscriberId };
  }

  /** Broadcastet ein Event an alle (oder gefilterten) Subscriber. */
  broadcast<T>(
    kind: SseEvent<T>["kind"],
    payload: T,
    filter?: SseEventKind[],
  ): void {
    const event: SseEvent<T> = {
      id: makeEventId(),
      kind,
      payload,
      timestamp: new Date().toISOString(),
    };

    const encoded = encoder.encode(encodeSseEvent(event));

    for (const sub of this.subscribers.values()) {
      // Event-Filter prüfen
      if (sub.filter && !sub.filter.includes(kind)) continue;
      if (filter && !filter.includes(kind)) continue;

      try {
        sub.controller.enqueue(encoded);
      } catch {
        // Verbindung bereits geschlossen — Subscriber entfernen
        this.subscribers.delete(sub.id);
      }
    }
  }

  /** Keep-alive-Ping an alle Subscriber. */
  ping(): void {
    const msg = encoder.encode(encodePing(new Date().toISOString()));

    for (const sub of this.subscribers.values()) {
      try {
        sub.controller.enqueue(msg);
      } catch {
        this.subscribers.delete(sub.id);
      }
    }
  }

  /** Anzahl aktiver Verbindungen. */
  get connectionCount(): number {
    return this.subscribers.size;
  }

  destroy(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);

    for (const sub of this.subscribers.values()) {
      try { sub.controller.close(); } catch { /* already closed */ }
    }

    this.subscribers.clear();
  }
}

// Singleton — ein Broadcaster pro Prozess
export const broadcaster = new SseBroadcaster();
