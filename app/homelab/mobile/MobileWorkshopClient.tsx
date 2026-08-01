/**
 * Mobile Workshop Client (Etappe 13d).
 *
 * Fokus auf Node Health und laufende Orders.
 * SSE-Verbindung für Live-Updates (gleicher Endpunkt wie Desktop).
 * Akku-Warnung via Battery-API (falls verfügbar).
 */

"use client";

import { useState, useEffect } from "react";
import type { HermesOrder, HermesSession } from "@/lib/hermes";
import type { HeartbeatPayload, OrderUpdatePayload, SessionUpdatePayload } from "@/lib/sse/types";

interface Props {
  initialRunningOrders: HermesOrder[];
  initialActiveSessions: HermesSession[];
}

interface BatteryState {
  level: number | null;     // 0–1
  charging: boolean | null;
  supported: boolean;
}

const STATE_COLORS: Record<string, string> = {
  running: "text-blue-300", pending: "text-yellow-400",
  completed: "text-emerald-400", failed: "text-red-400",
};

function useBattery(): BatteryState {
  const [battery, setBattery] = useState<BatteryState>({
    level: null, charging: null, supported: false,
  });

  useEffect(() => {
    if (!("getBattery" in navigator)) return;

    (navigator as Navigator & { getBattery(): Promise<BatteryManager> })
      .getBattery()
      .then((bm: BatteryManager) => {
        const update = () => setBattery({
          level: bm.level,
          charging: bm.charging,
          supported: true,
        });

        update();
        bm.addEventListener("levelchange", update);
        bm.addEventListener("chargingchange", update);

        return () => {
          bm.removeEventListener("levelchange", update);
          bm.removeEventListener("chargingchange", update);
        };
      })
      .catch(() => {/* Battery API nicht erlaubt */});
  }, []);

  return battery;
}

interface BatteryManager extends EventTarget {
  level: number;
  charging: boolean;
}

export function MobileWorkshopClient({ initialRunningOrders, initialActiveSessions }: Props) {
  const [orders, setOrders] = useState<HermesOrder[]>(initialRunningOrders);
  const [sessions, setSessions] = useState<HermesSession[]>(initialActiveSessions);
  const [heartbeats, setHeartbeats] = useState<HeartbeatPayload[]>([]);
  const [connected, setConnected] = useState(false);
  const battery = useBattery();

  // ── SSE ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const es = new EventSource(
      "/api/workshop/events?filter=order-update,session-update,heartbeat",
    );

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.addEventListener("order-update", (e: MessageEvent) => {
      const p = JSON.parse(e.data) as OrderUpdatePayload;
      setOrders((prev) => {
        const idx = prev.findIndex((o) => o.orderId === p.orderId);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], state: p.state as HermesOrder["state"] };
        return next.filter((o) => o.state === "running" || o.state === "pending");
      });
    });

    es.addEventListener("session-update", (e: MessageEvent) => {
      const p = JSON.parse(e.data) as SessionUpdatePayload;
      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.sessionId === p.sessionId);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = { ...next[idx], phase: p.phase as HermesSession["phase"] };
        return next;
      });
    });

    es.addEventListener("heartbeat", (e: MessageEvent) => {
      setHeartbeats((prev) => [JSON.parse(e.data) as HeartbeatPayload, ...prev.slice(0, 4)]);
    });

    return () => es.close();
  }, []);

  const batteryWarning =
    battery.supported &&
    battery.level !== null &&
    battery.level < 0.2 &&
    battery.charging === false;

  return (
    <div className="px-4 py-5 space-y-5">
      {/* ── Akku-Warnung ── */}
      {batteryWarning && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/40 px-4 py-3 text-sm text-amber-300">
          ⚡ Akku unter 20% ({Math.round((battery.level ?? 0) * 100)}%) —
          ALFRET hält schwere Aufgaben zurück.
        </div>
      )}

      {/* ── Verbindungs-Indikator ── */}
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-zinc-600"}`} />
        {connected ? "Live" : "Offline"}
        {battery.supported && battery.level !== null && (
          <span className="ml-auto">
            {battery.charging ? "⚡" : "🔋"} {Math.round(battery.level * 100)}%
          </span>
        )}
      </div>

      {/* ── Laufende Orders ── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          Laufende Orders
        </h2>
        {orders.length === 0 ? (
          <p className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-6 text-center text-sm text-zinc-500">
            Keine laufenden Orders.
          </p>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => (
              <div key={order.orderId} className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-mono text-zinc-400 truncate">
                      {order.orderId.slice(0, 12)}…
                    </div>
                    <div className={`text-sm font-semibold ${STATE_COLORS[order.state]}`}>
                      {order.state}
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {new Date(order.updatedAt).toLocaleTimeString("de-DE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Aktive Sessions ── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-zinc-300 uppercase tracking-wider">
          Sessions
        </h2>
        {sessions.length === 0 ? (
          <p className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-6 text-center text-sm text-zinc-500">
            Keine aktiven Sessions.
          </p>
        ) : (
          <div className="space-y-2">
            {sessions.slice(0, 5).map((session) => (
              <div key={session.sessionId} className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
                <div className="text-xs font-mono text-zinc-400 truncate">
                  {session.sessionId.slice(0, 12)}…
                </div>
                <div className="mt-1 text-sm text-zinc-300">
                  {session.phase}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Heartbeats ── */}
      {heartbeats.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-zinc-300 uppercase tracking-wider">
            Letzte Heartbeats
          </h2>
          <div className="space-y-2">
            {heartbeats.map((hb, i) => (
              <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs">
                <div className="font-mono text-zinc-400 truncate">
                  {hb.agentId.slice(0, 12)}…
                </div>
                <div className="text-zinc-500">{hb.status}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
