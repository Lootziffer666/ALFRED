// React hook: WebSocket client for daemon bridge (browser-side).
// Reconnects automatically, buffers messages during downtime.

"use client";

import { useEffect, useReducer, useRef } from "react";
import type { BridgeMessage, DaemonStatus } from "../daemon/bridge.js";

export interface DaemonBridgeState {
  status: DaemonStatus | null;
  connected: boolean;
  error: string | null;
}

type BridgeAction =
  | { type: "connect" }
  | { type: "disconnect" }
  | { type: "status"; payload: DaemonStatus }
  | { type: "error"; payload: string };

const initialState: DaemonBridgeState = {
  status: null,
  connected: false,
  error: null,
};

function reducer(state: DaemonBridgeState, action: BridgeAction): DaemonBridgeState {
  switch (action.type) {
    case "connect":
      return { ...state, connected: true, error: null };
    case "disconnect":
      return { ...state, connected: false };
    case "status":
      return { ...state, status: action.payload, error: null };
    case "error":
      return { ...state, error: action.payload, connected: false };
  }
}

export function useDaemonBridge(
  bridgeUrl: string = "ws://localhost:9090",
): DaemonBridgeState & { ping(): void } {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageQueueRef = useRef<BridgeMessage[]>([]);

  useEffect(() => {
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;

      try {
        const socket = new WebSocket(bridgeUrl);

        socket.onopen = () => {
          if (isMounted) {
            dispatch({ type: "connect" });

            // Flush queued messages
            while (messageQueueRef.current.length > 0) {
              const msg = messageQueueRef.current.shift();
              if (msg && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify(msg));
              }
            }
          }
        };

        socket.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const msg = JSON.parse(event.data) as BridgeMessage;
            if (msg.kind === "status" || msg.kind === "pong" || msg.kind === "tick") {
              const status = (msg.payload as any).status;
              if (status) {
                dispatch({ type: "status", payload: status });
              }
            } else if (msg.kind === "error") {
              dispatch({ type: "error", payload: (msg.payload as any).error });
            }
          } catch (err) {
            dispatch({ type: "error", payload: String(err) });
          }
        };

        socket.onerror = () => {
          if (isMounted) {
            dispatch({ type: "error", payload: "WebSocket error" });
          }
        };

        socket.onclose = () => {
          if (isMounted) {
            dispatch({ type: "disconnect" });
            // Reconnect after 3s
            reconnectTimeoutRef.current = setTimeout(connect, 3000);
          }
        };

        socketRef.current = socket;
      } catch (err) {
        if (isMounted) {
          dispatch({ type: "error", payload: String(err) });
        }
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [bridgeUrl]);

  const ping = () => {
    const msg: BridgeMessage = {
      kind: "ping",
      id: `ping-${Date.now()}`,
      timestamp: new Date().toISOString(),
      payload: {},
    };

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    } else {
      messageQueueRef.current.push(msg);
    }
  };

  return { ...state, ping };
}
