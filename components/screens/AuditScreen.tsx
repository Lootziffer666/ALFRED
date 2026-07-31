"use client";

import { useState } from "react";
import { useSession } from "../session/SessionContext";
import { sessionToJson, sessionToMarkdown } from "@/lib/export";
import type { CriterionVerdict } from "@/lib/schema";

const VERDICT_COLORS: Record<CriterionVerdict, string> = {
  passed: "var(--ok)",
  partially_passed: "var(--brass-l)",
  failed: "var(--zinnober)",
  not_proven: "var(--hyp)",
  not_applicable: "var(--mut)",
};

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function AuditScreen() {
  const {
    auditUrl,
    setAuditUrl,
    auditDiff,
    setAuditDiff,
    agentSummary,
    setAgentSummary,
    auditLoading,
    auditError,
    auditReport,
    runAudit,
    demoMode,
    buildExport,
    reset,
  } = useSession();
  const [mode, setMode] = useState<"url" | "diff">("diff");

  return (
    <section className="card" style={{ padding: 20 }}>
      <h2 style={{ fontSize: 20, margin: "0 0 4px" }}>§ 5 · Result audit</h2>
      <p className="serif" style={{ color: "var(--paper-dim)", marginTop: 0, fontSize: 14 }}>
        Classify a submitted change against the handoff&apos;s acceptance criteria. Completion claims alone are never enough.
      </p>

      {!demoMode && (
        <div className="card-inset" style={{ padding: 14, marginTop: 14 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <ModeButton label="Paste diff" active={mode === "diff"} onClick={() => setMode("diff")} />
            <ModeButton label="PR / compare URL" active={mode === "url"} onClick={() => setMode("url")} />
          </div>
          {mode === "url" ? (
            <input
              type="text"
              value={auditUrl}
              onChange={(e) => setAuditUrl(e.target.value)}
              placeholder="https://github.com/owner/repo/pull/123"
            />
          ) : (
            <textarea rows={8} value={auditDiff} onChange={(e) => setAuditDiff(e.target.value)} placeholder="Paste a unified diff (git diff / PR patch)…" style={{ fontFamily: "var(--font-mono)" }} />
          )}
          <label style={{ display: "block", marginTop: 10 }}>
            <span className="mono" style={{ display: "block", fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--mut)", marginBottom: 5 }}>
              Agent completion summary (optional — checked against the diff, not taken at face value)
            </span>
            <textarea rows={2} value={agentSummary} onChange={(e) => setAgentSummary(e.target.value)} placeholder="Paste what the coding agent claimed it did…" />
          </label>
          {auditError && (
            <p className="mono" style={{ color: "var(--zinnober)", fontSize: 12 }} role="alert">
              {auditError}
            </p>
          )}
          <div style={{ marginTop: 10 }}>
            <button
              className="primary"
              type="button"
              disabled={auditLoading || (mode === "url" ? !auditUrl.trim() : !auditDiff.trim())}
              onClick={() => runAudit(mode)}
            >
              {auditLoading ? "Auditing…" : "Run audit →"}
            </button>
          </div>
        </div>
      )}

      {auditReport && (
        <div style={{ marginTop: 18 }}>
          <p className="serif" style={{ fontSize: 14 }}>{auditReport.summary}</p>

          <div className="mono" style={{ fontSize: 11, color: "var(--mut)", marginTop: 10, marginBottom: 6 }}>
            CHANGED FILES ({auditReport.changedFiles.length})
          </div>
          <div className="scroll-x">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }} className="mono">
              <tbody>
                {auditReport.changedFiles.map((f, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                    <td style={{ padding: "5px 6px" }}>{f.path}</td>
                    <td style={{ padding: "5px 6px", color: "var(--mut)" }}>{f.status}</td>
                    <td style={{ padding: "5px 6px", color: "var(--ok)" }}>+{f.additions}</td>
                    <td style={{ padding: "5px 6px", color: "var(--zinnober)" }}>-{f.deletions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mono" style={{ fontSize: 11, color: "var(--mut)", marginTop: 16, marginBottom: 6 }}>
            CRITERIA
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {auditReport.criteria.map((c) => (
              <div key={c.criterionId} className="card-inset" style={{ padding: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13.5 }}>{c.criterionText}</span>
                  <span className="pill">
                    <span className="dot" style={{ background: VERDICT_COLORS[c.verdict] }} />
                    {c.verdict.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="serif" style={{ fontSize: 12.5, margin: "6px 0 0", color: "var(--paper-dim)" }}>{c.note}</p>
                {c.evidence.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                    {c.evidence.map((e, i) => (
                      <span key={i} className="pill">{e.source}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {auditReport.unsupportedClaims.length > 0 && (
            <div className="card-inset" style={{ padding: 12, marginTop: 14, borderColor: "var(--zinnober)" }}>
              <div className="mono" style={{ fontSize: 10, color: "var(--zinnober)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                ⚠ Unsupported agent claims
              </div>
              {auditReport.unsupportedClaims.map((u, i) => (
                <p key={i} className="serif" style={{ fontSize: 13, margin: "4px 0" }}>{u}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 20, flexWrap: "wrap", borderTop: "1px solid var(--line)", paddingTop: 16 }}>
        <button
          type="button"
          onClick={() => download(`alfret-session-${Date.now()}.md`, sessionToMarkdown(buildExport()), "text/markdown")}
        >
          ⧉ Export Markdown
        </button>
        <button
          type="button"
          onClick={() => download(`alfret-session-${Date.now()}.json`, sessionToJson(buildExport()), "application/json")}
        >
          ⧉ Export JSON
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Start a new session? This discards the current inventory, contract map, handoff and audit report.")) {
              reset();
            }
          }}
          style={{ marginLeft: "auto" }}
        >
          ↺ New session
        </button>
      </div>
    </section>
  );
}

function ModeButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mono"
      style={{
        fontSize: 11,
        border: `1px solid ${active ? "var(--brass)" : "var(--line)"}`,
        background: active ? "rgba(183,138,62,.12)" : "var(--ink2)",
        color: active ? "var(--brass-l)" : "var(--mut)",
      }}
    >
      {label}
    </button>
  );
}
