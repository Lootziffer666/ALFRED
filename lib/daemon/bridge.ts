// WebSocket bridge: daemon status streaming to Next.js clients.
// Bidirectional: clients poll status, daemon pushes tick results.

import type { DaemonContext } from "./context.js";
import type { TickResult } from "./jobs/types.js";

export type BridgeMessageKind = "ping" | "pong" | "status" | "tick" | "command" | "error";

export interface BridgeMessage {
  kind: BridgeMessageKind;
  id: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface DaemonStatus {
  pid: number;
  uptime: number;
  armed: boolean;
  dryRun: boolean;
  repositoriesCount: number;
  lastTick?: {
    tickedAt: string;
    totalDurationMs: number;
    repos: number;
  };
}

export interface BridgeOptions {
  ctx: DaemonContext;
  port?: number;
  host?: string;
}

export interface BridgeHandle {
  close(): Promise<void>;
  getStatus(): DaemonStatus;
  broadcastTick(tick: TickResult): void;
}

let wsServer: any = null;
const clients: Set<any> = new Set();
let daemonStatus: DaemonStatus | null = null;

export async function startBridge(opts: BridgeOptions): Promise<BridgeHandle> {
  const { ctx, port = 9090, host = "localhost" } = opts;

  // Lazy-load ws only if WebSocket support is needed
  const ws = await import("ws");
  const { WebSocketServer } = ws;

  wsServer = new WebSocketServer({ port, host });
  daemonStatus = {
    pid: process.pid,
    uptime: 0,
    armed: ctx.config.armed,
    dryRun: ctx.config.dryRun,
    repositoriesCount: Object.keys(ctx.config.repositories).length,
  };

  wsServer.on("connection", (socket: any) => {
    clients.add(socket);

    socket.on("message", async (data: Buffer) => {
      try {
        const msg = JSON.parse(data.toString("utf-8")) as BridgeMessage;
        await handleMessage(msg, socket, ctx);
      } catch (err) {
        socket.send(
          JSON.stringify({
            kind: "error",
            id: "parse-error",
            timestamp: new Date().toISOString(),
            payload: { error: String(err) },
          }),
        );
      }
    });

    socket.on("close", () => {
      clients.delete(socket);
    });

    // Send welcome pong
    socket.send(
      JSON.stringify({
        kind: "pong",
        id: "welcome",
        timestamp: new Date().toISOString(),
        payload: { status: daemonStatus },
      }),
    );
  });

  ctx.log.info("Bridge started", { port, host });

  return {
    async close() {
      for (const client of clients) {
        client.close();
      }
      await new Promise((resolve) => {
        wsServer?.close(resolve);
      });
    },
    getStatus() {
      return daemonStatus!;
    },
    broadcastTick(tick) {
      daemonStatus = {
        ...daemonStatus!,
        uptime: Math.round((Date.now() - process.uptime() * 1000) / 1000),
        lastTick: {
          tickedAt: tick.tickedAt,
          totalDurationMs: tick.totalDurationMs,
          repos: tick.repos.length,
        },
      };

      const msg: BridgeMessage = {
        kind: "tick",
        id: tick.id,
        timestamp: new Date().toISOString(),
        payload: { tick, status: daemonStatus },
      };

      for (const client of clients) {
        if (client.readyState === 1) {
          client.send(JSON.stringify(msg));
        }
      }
    },
  };
}

async function handleMessage(
  msg: BridgeMessage,
  socket: any,
  ctx: DaemonContext,
): Promise<void> {
  switch (msg.kind) {
    case "ping":
      socket.send(
        JSON.stringify({
          kind: "pong",
          id: msg.id,
          timestamp: new Date().toISOString(),
          payload: { status: daemonStatus },
        }),
      );
      break;

    case "status":
      socket.send(
        JSON.stringify({
          kind: "status",
          id: msg.id,
          timestamp: new Date().toISOString(),
          payload: { status: daemonStatus },
        }),
      );
      break;

    case "command":
      // Placeholder for command execution (arm/disarm/login)
      socket.send(
        JSON.stringify({
          kind: "error",
          id: msg.id,
          timestamp: new Date().toISOString(),
          payload: { error: "Commands not yet implemented" },
        }),
      );
      break;

    default:
      socket.send(
        JSON.stringify({
          kind: "error",
          id: msg.id,
          timestamp: new Date().toISOString(),
          payload: { error: `Unknown message kind: ${msg.kind}` },
        }),
      );
  }
}
