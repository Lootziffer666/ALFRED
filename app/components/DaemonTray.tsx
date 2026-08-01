"use client";

import React, { useEffect, useState } from "react";
import { useDaemonBridge } from "@/lib/client/useDaemonBridge";

interface DaemonTrayProps {
  bridgeUrl?: string;
}

export function DaemonTray({ bridgeUrl }: DaemonTrayProps) {
  const { status, connected, error, ping } = useDaemonBridge(bridgeUrl);
  const [expandedRepos, setExpandedRepos] = useState(false);

  useEffect(() => {
    // Ping every 5s to keep status fresh
    const interval = setInterval(ping, 5000);
    return () => clearInterval(interval);
  }, [ping]);

  if (error && !connected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        Daemon offline: {error}
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded bg-slate-50 border border-slate-200 text-slate-700 text-sm">
        <div className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
        Connecting...
      </div>
    );
  }

  const lastTickMinutesAgo = status.lastTick
    ? Math.floor((Date.now() - new Date(status.lastTick.tickedAt).getTime()) / 60000)
    : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 px-3 py-2 rounded bg-slate-50 border border-slate-200">
        <div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-yellow-500"}`} />
        <div className="flex-1 text-sm">
          <div className="font-medium">Daemon PID {status.pid}</div>
          <div className="text-xs text-slate-600">
            {status.armed ? "🔓 Armed" : "🔒 Disarmed"} • {status.dryRun ? "Dry-run" : "Live"}
          </div>
        </div>
        <div className="text-xs text-slate-500">{status.repositoriesCount} repos</div>
      </div>

      {status.lastTick && (
        <div className="px-3 py-2 rounded bg-blue-50 border border-blue-200 text-xs space-y-1">
          <div className="font-medium text-blue-900">Last tick</div>
          <div className="text-blue-800">
            {lastTickMinutesAgo === 0 ? "Just now" : `${lastTickMinutesAgo}m ago`}
          </div>
          <div className="text-blue-700">
            {status.lastTick.repos} repos • {status.lastTick.totalDurationMs}ms
          </div>
        </div>
      )}

      <button
        onClick={() => setExpandedRepos(!expandedRepos)}
        className="w-full text-left px-3 py-2 rounded bg-slate-100 hover:bg-slate-200 text-sm text-slate-700 font-medium transition"
      >
        {expandedRepos ? "▼" : "▶"} Repositories ({status.repositoriesCount})
      </button>

      {expandedRepos && (
        <div className="pl-4 pr-3 py-2 rounded bg-slate-50 border border-slate-200 max-h-48 overflow-y-auto">
          <div className="text-xs space-y-1">
            {Object.keys(Object.entries({}).length === 0 ? { "No repos registered": {} } : {}).map(
              (repo) => (
                <div key={repo} className="text-slate-600">
                  • {repo}
                </div>
              ),
            )}
          </div>
        </div>
      )}

      <div className="flex gap-2 text-xs">
        <button
          onClick={ping}
          className="flex-1 px-2 py-1 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium transition"
        >
          Refresh
        </button>
        <a
          href="/daemon/status"
          className="flex-1 px-2 py-1 rounded bg-blue-500 hover:bg-blue-600 text-white font-medium text-center transition"
        >
          Details
        </a>
      </div>
    </div>
  );
}
