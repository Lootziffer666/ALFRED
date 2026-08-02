"use client";

import { useState } from "react";
import { useSession } from "../session/SessionContext";
import {
  CARD_CLASS,
  DOCUMENT_TEXTAREA_CLASS,
  PAPER_CLASS,
  PAPER_GHOST_BUTTON_CLASS,
  PAPER_HEADING_CLASS,
  PAPER_LABEL_CLASS,
  PAPER_SUBTEXT_CLASS,
  PRIMARY_BUTTON_CLASS,
  SECTION_KICKER_CLASS,
} from "./styles";

function linesToArray(v: string): string[] {
  return v
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function HandoffScreen() {
  const { handoff, updateHandoff, setStep } = useSession();
  const [copied, setCopied] = useState(false);

  if (!handoff) {
    return (
      <section className={CARD_CLASS}>
        <p className="font-body-md text-on-surface-variant italic">No handoff has been generated yet.</p>
      </section>
    );
  }

  const copyHandoff = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(handoff, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API may be unavailable; the JSON export on the audit step still works.
    }
  };

  return (
    <section className={PAPER_CLASS}>
      <div className="flex items-center gap-2 mb-2">
        <span className={SECTION_KICKER_CLASS}>§ 4</span>
        <div className="h-px w-8 bg-primary/30" />
      </div>
      <h2 className={PAPER_HEADING_CLASS}>Refinery — Agent Handoff</h2>
      <p className={PAPER_SUBTEXT_CLASS}>Editable before export. Nothing here writes to the repository.</p>

      <div className="grid gap-5">
        <TextField label="Objective" value={handoff.objective} onChange={(v) => updateHandoff({ objective: v })} rows={2} />
        <TextField label="Current verified state" value={handoff.currentVerifiedState} onChange={(v) => updateHandoff({ currentVerifiedState: v })} rows={3} mono />
        <ListField label="Non-goals" values={handoff.nonGoals} onChange={(v) => updateHandoff({ nonGoals: v })} />
        <ListField label="Constraints" values={handoff.constraints} onChange={(v) => updateHandoff({ constraints: v })} />
        <ListField label="Relevant files" values={handoff.relevantFiles} onChange={(v) => updateHandoff({ relevantFiles: v })} mono />
        <ListField label="Deliverables" values={handoff.deliverables} onChange={(v) => updateHandoff({ deliverables: v })} />

        <div>
          <span className={PAPER_LABEL_CLASS}>Acceptance criteria</span>
          <div className="grid gap-3">
            {handoff.acceptanceCriteria.map((c, i) => (
              <div key={c.id}>
                <span className="font-technical-data text-primary text-[11px] block mb-1 break-all">{c.id}</span>
                <textarea
                  rows={2}
                  value={c.text}
                  onChange={(e) => {
                    const next = handoff.acceptanceCriteria.slice();
                    next[i] = { ...c, text: e.target.value };
                    updateHandoff({ acceptanceCriteria: next });
                  }}
                  className={DOCUMENT_TEXTAREA_CLASS}
                />
              </div>
            ))}
          </div>
        </div>

        <ListField label="Required tests & evidence" values={handoff.requiredTestsAndEvidence} onChange={(v) => updateHandoff({ requiredTestsAndEvidence: v })} />
        <ListField label="Prohibited changes" values={handoff.prohibitedChanges} onChange={(v) => updateHandoff({ prohibitedChanges: v })} />
        <ListField label="Stop conditions" values={handoff.stopConditions} onChange={(v) => updateHandoff({ stopConditions: v })} />
        <TextField label="Required final response format" value={handoff.responseFormat} onChange={(v) => updateHandoff({ responseFormat: v })} rows={2} />
      </div>

      <div className="flex gap-3 mt-8 flex-wrap border-t border-black/10 pt-6">
        <button type="button" onClick={copyHandoff} className={PAPER_GHOST_BUTTON_CLASS}>
          {copied ? "Copied ✓" : "Copy handoff JSON"}
        </button>
        <button type="button" onClick={() => setStep("audit")} className={PRIMARY_BUTTON_CLASS}>
          Continue to result audit →
        </button>
      </div>
    </section>
  );
}

function TextField({ label, value, onChange, rows = 2, mono = false }: { label: string; value: string; onChange: (v: string) => void; rows?: number; mono?: boolean }) {
  return (
    <label className="block">
      <span className={PAPER_LABEL_CLASS}>{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${DOCUMENT_TEXTAREA_CLASS} ${mono ? "font-technical-data" : "font-body-md"}`}
      />
    </label>
  );
}

function ListField({ label, values, onChange, mono = false }: { label: string; values: string[]; onChange: (v: string[]) => void; mono?: boolean }) {
  return (
    <label className="block">
      <span className={PAPER_LABEL_CLASS}>
        {label} <span className="text-black/30 normal-case tracking-normal">(one per line)</span>
      </span>
      <textarea
        rows={Math.max(2, values.length)}
        value={values.join("\n")}
        onChange={(e) => onChange(linesToArray(e.target.value))}
        className={`${DOCUMENT_TEXTAREA_CLASS} ${mono ? "font-technical-data" : "font-body-md"}`}
      />
    </label>
  );
}
