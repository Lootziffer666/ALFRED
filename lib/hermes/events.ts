import type { HermesEvent, HermesEventKind } from "./types";

/**
 * Event-Erzeugung.
 *
 * Events sind append-only. Sie werden nicht verändert oder gelöscht.
 * Der Event-Stream ist das Gedächtnis von Hermes für laufende Aufträge.
 */

let _seq = 0;

function nextEventId(): string {
  return `evt-${Date.now()}-${++_seq}`;
}

export function makeEvent(
  kind: HermesEventKind,
  orderId: string,
  payload: Record<string, unknown>,
  sessionId: string | null = null,
): HermesEvent {
  return {
    eventId: nextEventId(),
    kind,
    orderId,
    sessionId,
    payload,
    timestamp: new Date().toISOString(),
  };
}

/**
 * In-Memory Event-Store für einen einzelnen Auftrag.
 * In Etappe 11+ wird dieser durch einen persistenten Store ersetzt.
 */
export class OrderEventLog {
  private readonly log: HermesEvent[] = [];

  append(event: HermesEvent): void {
    this.log.push(event);
  }

  for(orderId: string): HermesEvent[] {
    return this.log.filter((e) => e.orderId === orderId);
  }

  async *stream(orderId: string): AsyncGenerator<HermesEvent> {
    for (const e of this.log.filter((e) => e.orderId === orderId)) {
      yield e;
    }
  }
}
