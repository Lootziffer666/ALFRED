// WebSocket bridge: daemon status streaming to Next.js clients.
// Bidirectional: clients poll status, daemon pushes tick results.
// Note: Requires 'ws' module. Currently a no-op stub for Phase 1.5 stabilization.

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

let daemonStatus: DaemonStatus | null = null;

export async function startBridge(opts: BridgeOptions): Promise<BridgeHandle> {
  const { ctx } = opts;

  daemonStatus = {
    pid: process.pid,
    uptime: 0,
    armed: ctx.config.armed,
    dryRun: ctx.config.dryRun,
    repositoriesCount: Object.keys(ctx.config.repositories).length,
  };

  ctx.log.info("Bridge stub initialized (ws module required for real functionality)");

  return {
    async close() {
      // No-op: ws module not available yet
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
    },
  };
}
