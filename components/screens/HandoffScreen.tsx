"use client";

import { useState } from "react";
import { useSession } from "../session/SessionContext";

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
      <section className="card" style={{ padding: 20 }}>
        <p className="serif">No handoff has been generated yet.</p>
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
    <section className="card" style={{ padding: 20 }}>
      <h2 style={{ fontSize: 20, margin: "0 0 4px" }}>§ 4 · Agent handoff</h2>
      <p className="serif" style={{ color: "var(--paper-dim)", marginTop: 0, fontSize: 14 }}>
        Editable before export. Nothing here writes to the repository.
      </p>

      <TextField label="Objective" value={handoff.objective} onChange={(v) => updateHandoff({ objective: v })} rows={2} />
      <TextField label="Current verified state" value={handoff.currentVerifiedState} onChange={(v) => updateHandoff({ currentVerifiedState: v })} rows={3} mono />
      <ListField label="Non-goals" values={handoff.nonGoals} onChange={(v) => updateHandoff({ nonGoals: v })} />
      <ListField label="Constraints" values={handoff.constraints} onChange={(v) => updateHandoff({ constraints: v })} />
      <ListField label="Relevant files" values={handoff.relevantFiles} onChange={(v) => updateHandoff({ relevantFiles: v })} mono />
      <ListField label="Deliverables" values={handoff.deliverables} onChange={(v) => updateHandoff({ deliverables: v })} />

      <div style={{ marginTop: 12 }}>
        <span className="mono" style={{ display: "block", fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--mut)", marginBottom: 5 }}>
          Acceptance criteria
        </span>
        {handoff.acceptanceCriteria.map((c, i) => (
          <div key={c.id} style={{ marginBottom: 10 }}>
            <span className="mono" style={{ color: "var(--zinnober)", fontSize: 11, display: "block", marginBottom: 3, wordBreak: "break-all" }}>{c.id}</span>
            <textarea
              rows={2}
              value={c.text}
              onChange={(e) => {
                const next = handoff.acceptanceCriteria.slice();
                next[i] = { ...c, text: e.target.value };
                updateHandoff({ acceptanceCriteria: next });
              }}
            />
          </div>
        ))}
      </div>

      <ListField label="Required tests & evidence" values={handoff.requiredTestsAndEvidence} onChange={(v) => updateHandoff({ requiredTestsAndEvidence: v })} />
      <ListField label="Prohibited changes" values={handoff.prohibitedChanges} onChange={(v) => updateHandoff({ prohibitedChanges: v })} />
      <ListField label="Stop conditions" values={handoff.stopConditions} onChange={(v) => updateHandoff({ stopConditions: v })} />
      <TextField label="Required final response format" value={handoff.responseFormat} onChange={(v) => updateHandoff({ responseFormat: v })} rows={2} />

      <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
        <button type="button" onClick={copyHandoff}>{copied ? "Copied ✓" : "Copy handoff JSON"}</button>
        <button className="primary" type="button" onClick={() => setStep("audit")}>
          Continue to result audit →
        </button>
      </div>
    </section>
  );
}

function TextField({ label, value, onChange, rows = 2, mono = false }: { label: string; value: string; onChange: (v: string) => void; rows?: number; mono?: boolean }) {
  return (
    <label style={{ display: "block", marginTop: 12 }}>
      <span className="mono" style={{ display: "block", fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--mut)", marginBottom: 5 }}>
        {label}
      </span>
      <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} style={mono ? { fontFamily: "var(--font-mono)" } : undefined} />
    </label>
  );
}

function ListField({ label, values, onChange, mono = false }: { label: string; values: string[]; onChange: (v: string[]) => void; mono?: boolean }) {
  return (
    <label style={{ display: "block", marginTop: 12 }}>
      <span className="mono" style={{ display: "block", fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--mut)", marginBottom: 5 }}>
        {label} <span style={{ color: "var(--mut)", textTransform: "none" }}>(one per line)</span>
      </span>
      <textarea
        rows={Math.max(2, values.length)}
        value={values.join("\n")}
        onChange={(e) => onChange(linesToArray(e.target.value))}
        style={mono ? { fontFamily: "var(--font-mono)" } : undefined}
      />
    </label>
  );
}
