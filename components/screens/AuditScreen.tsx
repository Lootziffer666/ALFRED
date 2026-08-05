"use client";

import { useState } from "react";
import { useSession } from "../session/SessionContext";
import { sessionToJson, sessionToMarkdown } from "@/lib/export";
import type { CriterionVerdict } from "@/lib/schema";
import { CARD_CLASS, CARD_INSET_CLASS, GHOST_BUTTON_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS, SECTION_KICKER_CLASS, TEXTAREA_CLASS, INPUT_CLASS } from "./styles";

const VERDICT_CLASSES: Record<CriterionVerdict, string> = {
  passed: "text-tertiary border-tertiary/30 bg-tertiary/10",
  partially_passed: "text-secondary border-secondary/30 bg-secondary/10",
  failed: "text-primary border-primary/30 bg-primary/10",
  not_proven: "text-on-surface-variant/60 border-outline-variant/30 bg-surface-container-highest/20",
  not_applicable: "text-on-surface-variant/40 border-outline-variant/20 bg-transparent",
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
    <section className={CARD_CLASS}>
      <div className="flex items-center gap-2 mb-2">
        <span className={SECTION_KICKER_CLASS}>§ 5</span>
        <div className="h-px w-8 bg-primary/30" />
      </div>
      <h2 className="font-document-heading text-2xl text-on-surface mb-1">Result Audit</h2>
      <p className="font-body-md text-on-surface-variant text-sm italic mt-0 mb-6">
        Classify a submitted change against the handoff&apos;s acceptance criteria. Completion claims alone are never enough.
      </p>

      {!demoMode && (
        <div className={CARD_INSET_CLASS}>
          <div className="flex gap-2 mb-3">
            <ModeButton label="Paste diff" active={mode === "diff"} onClick={() => setMode("diff")} />
            <ModeButton label="PR / compare URL" active={mode === "url"} onClick={() => setMode("url")} />
          </div>
          {mode === "url" ? (
            <input
              type="text"
              value={auditUrl}
              onChange={(e) => setAuditUrl(e.target.value)}
              placeholder="https://github.com/owner/repo/pull/123"
              className={INPUT_CLASS}
            />
          ) : (
            <textarea
              rows={8}
              value={auditDiff}
              onChange={(e) => setAuditDiff(e.target.value)}
              placeholder="Paste a unified diff (git diff / PR patch)…"
              className={`${TEXTAREA_CLASS} font-technical-data`}
            />
          )}
          <label className="block mt-3">
            <span className={LABEL_CLASS}>Agent completion summary (optional — checked against the diff, not taken at face value)</span>
            <textarea
              rows={2}
              value={agentSummary}
              onChange={(e) => setAgentSummary(e.target.value)}
              placeholder="Paste what the coding agent claimed it did…"
              className={TEXTAREA_CLASS}
            />
          </label>
          {auditError && (
            <p className="font-technical-data text-xs text-primary mt-2" role="alert">
              {auditError}
            </p>
          )}
          <div className="mt-3">
            <button
              type="button"
              disabled={auditLoading || (mode === "url" ? !auditUrl.trim() : !auditDiff.trim())}
              onClick={() => runAudit(mode)}
              className={PRIMARY_BUTTON_CLASS}
            >
              {auditLoading ? "Auditing…" : "Run audit →"}
            </button>
          </div>
        </div>
      )}

      {auditReport && (
        <div className="mt-6">
          <p className="font-body-md text-sm text-on-surface">{auditReport.summary}</p>

          <div className="font-technical-data text-[11px] text-on-surface-variant/50 uppercase tracking-widest mt-4 mb-1.5">
            Changed files ({auditReport.changedFiles.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse font-technical-data text-xs">
              <tbody>
                {auditReport.changedFiles.map((f, i) => (
                  <tr key={i} className="border-t border-outline-variant/10">
                    <td className="py-1.5 px-1.5 text-on-surface">{f.path}</td>
                    <td className="py-1.5 px-1.5 text-on-surface-variant/50">{f.status}</td>
                    <td className="py-1.5 px-1.5 text-tertiary">+{f.additions}</td>
                    <td className="py-1.5 px-1.5 text-primary">-{f.deletions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="font-technical-data text-[11px] text-on-surface-variant/50 uppercase tracking-widest mt-5 mb-1.5">
            Criteria
          </div>
          <div className="grid gap-2">
            {auditReport.criteria.map((c) => (
              <div key={c.criterionId} className={CARD_INSET_CLASS}>
                <div className="flex justify-between gap-2 flex-wrap">
                  <span className="text-[13.5px] text-on-surface">{c.criterionText}</span>
                  <span className={`px-2 py-0.5 rounded-full font-technical-data text-[10px] uppercase tracking-wide border ${VERDICT_CLASSES[c.verdict]}`}>
                    {c.verdict.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="font-body-md text-[12.5px] text-on-surface-variant mt-1.5 mb-0">{c.note}</p>
                {c.evidence.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mt-1.5">
                    {c.evidence.map((e, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full font-technical-data text-[10px] uppercase border border-outline-variant/20 text-on-surface-variant/60">
                        {e.source}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {auditReport.unsupportedClaims.length > 0 && (
            <div className="mt-4 p-4 rounded-lg border border-primary/40 bg-primary/5">
              <div className="font-technical-data text-[10px] text-primary uppercase tracking-widest mb-1.5">
                ⚠ Unsupported agent claims
              </div>
              {auditReport.unsupportedClaims.map((u, i) => (
                <p key={i} className="font-body-md text-[13px] text-on-surface my-1">{u}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 mt-6 flex-wrap border-t border-outline-variant/15 pt-5">
        <button
          type="button"
          onClick={() => download(`alfret-session-${Date.now()}.md`, sessionToMarkdown(buildExport()), "text/markdown")}
          className={GHOST_BUTTON_CLASS}
        >
          ⧉ Export Markdown
        </button>
        <button
          type="button"
          onClick={() => download(`alfret-session-${Date.now()}.json`, sessionToJson(buildExport()), "application/json")}
          className={GHOST_BUTTON_CLASS}
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
          className={`${GHOST_BUTTON_CLASS} ml-auto`}
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
      className={`font-technical-data text-[11px] uppercase tracking-wide px-3 py-2 rounded-full border transition-all ${
        active
          ? "border-primary-container bg-primary-container/15 text-primary"
          : "border-outline-variant/20 bg-surface-container text-on-surface-variant/60 hover:border-outline-variant/40"
      }`}
    >
      {label}
    </button>
  );
}
