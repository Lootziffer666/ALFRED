"use client";

/**
 * Workshop-Client (Etappe 11c).
 * Interaktive Kontrolltafel mit Demo-Trigger und Live-Ergebnissen.
 */

import { useState } from "react";

interface DemoResult {
  success: boolean;
  error?: string;
  demo?: {
    planId: string;
    orderId: string;
    taskId: string;
    order: {
      state: string;
      attempts: number;
    };
    session: {
      phase: string;
      worktree: string | null;
      headSha: string | null;
    };
    cueReport: {
      overall: string;
      blocksRelease: boolean;
      checks: number;
    };
    maidReport: {
      classifiedFilesCount: number;
      findings: number;
      proposals: number;
    };
  };
  storedCount?: {
    sessions: number;
    cueReports: number;
  };
}

export function WorkshopClient() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runDemo() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/demo/run", {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`);
      }

      const data: DemoResult = await res.json();
      setResult(data);

      if (!data.success) {
        setError(data.error || "Demo failed");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Demo-Trigger */}
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Demo-Zyklus</h2>
        <p className="text-slate-600 mb-6">
          Einen kompletten ALFRET-Zyklus ausführen: Plan → Hermes → CUE → Maid
        </p>
        <button
          onClick={runDemo}
          disabled={loading}
          className={`px-6 py-3 rounded-lg font-semibold text-white transition ${
            loading
              ? "bg-slate-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800"
          }`}
        >
          {loading ? "Läuft..." : "Demo ausführen"}
        </button>
      </section>

      {/* Fehleranzeige */}
      {error && (
        <section className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h3 className="text-lg font-bold text-red-900 mb-2">Fehler</h3>
          <p className="text-red-700 font-mono text-sm">{error}</p>
        </section>
      )}

      {/* Ergebnisse */}
      {result && result.success && result.demo && (
        <section className="space-y-6">
          {/* Übersicht */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Übersicht</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded">
                <div className="text-sm text-slate-600">Plan ID</div>
                <div className="font-mono text-xs text-slate-900 break-all">
                  {result.demo.planId}
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded">
                <div className="text-sm text-slate-600">Order ID</div>
                <div className="font-mono text-xs text-slate-900 break-all">
                  {result.demo.orderId}
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded">
                <div className="text-sm text-slate-600">Task ID</div>
                <div className="font-mono text-xs text-slate-900 break-all">
                  {result.demo.taskId}
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded">
                <div className="text-sm text-slate-600">Order State</div>
                <div className="font-mono text-xs text-slate-900">
                  {result.demo.order.state}
                </div>
              </div>
            </div>
          </div>

          {/* Session-Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Session</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Phase:</span>
                <span className="font-mono text-slate-900">{result.demo.session.phase}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Worktree:</span>
                <span className="font-mono text-slate-900">
                  {result.demo.session.worktree || "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">HEAD SHA:</span>
                <span className="font-mono text-xs text-slate-900">
                  {result.demo.session.headSha || "—"}
                </span>
              </div>
            </div>
          </div>

          {/* CUE-Report */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">CUE-Verifikation</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Gesamtverdikt:</span>
                <span
                  className={`font-bold ${
                    result.demo.cueReport.overall === "passed"
                      ? "text-green-600"
                      : "text-amber-600"
                  }`}
                >
                  {result.demo.cueReport.overall}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Blockiert Release:</span>
                <span className="font-mono text-slate-900">
                  {result.demo.cueReport.blocksRelease ? "Ja" : "Nein"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Checks:</span>
                <span className="font-mono text-slate-900">
                  {result.demo.cueReport.checks} durchgeführt
                </span>
              </div>
            </div>
          </div>

          {/* Maid-Report */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Maid-Scanning</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Klassifizierte Dateien:</span>
                <span className="font-mono text-slate-900">
                  {result.demo.maidReport.classifiedFilesCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Findings:</span>
                <span className="font-mono text-slate-900">
                  {result.demo.maidReport.findings}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Proposals:</span>
                <span className="font-mono text-slate-900">
                  {result.demo.maidReport.proposals}
                </span>
              </div>
            </div>
          </div>

          {/* Store-Status */}
          {result.storedCount && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-bold text-green-900 mb-2">Erfolgreich gespeichert</h3>
              <div className="space-y-2 text-sm text-green-700">
                <div>✓ {result.storedCount.sessions} Session(s)</div>
                <div>✓ {result.storedCount.cueReports} CUE-Report(s)</div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
