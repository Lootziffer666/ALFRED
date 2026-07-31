"use client";

import { useState, type CSSProperties } from "react";
import { REPORT_MODES, type Report } from "@/lib/report/modes";
import type { ParagraphClass, RenderedParagraph } from "@/lib/atoms/compose";
import { SHELL_SECTIONS, isEmpty } from "@/lib/report/structure";
import { EvidenceDrawer, type EvidenceSelection } from "./EvidenceDrawer";

const CLS_STYLE: Record<ParagraphClass, CSSProperties> = {
  "cue-ok": { borderLeft: "2px solid var(--ok)", paddingLeft: 12 },
  "cue-hyp": { borderLeft: "2px dashed var(--hyp)", paddingLeft: 12, color: "#c4c0b6" },
  "cue-bad": { borderLeft: "2px solid var(--zinnober)", paddingLeft: 12, background: "rgba(214,64,44,.05)" },
  "cue-notag": { borderLeft: "2px dashed var(--brass-d)", paddingLeft: 12, color: "#cfc8b8" },
};

function Paragraph({ p, onEvidence }: { p: RenderedParagraph; onEvidence: (s: EvidenceSelection) => void }) {
  const atomId = p.tags[0]?.label;
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <p className="serif" style={{ fontSize: 16.5, lineHeight: 1.62, margin: 0, color: "var(--paper)", ...CLS_STYLE[p.cls] }}>
        {p.text}
      </p>
      {p.evidence.length > 0 && atomId ? (
        <button
          type="button"
          className="pill"
          style={{ justifySelf: "start", marginLeft: 12 }}
          onClick={() => onEvidence({ atomId, text: p.text, evidence: p.evidence })}
        >
          <span className="dot" style={{ background: "var(--ok)" }} />
          {p.evidence.length} Beleg{p.evidence.length === 1 ? "" : "e"} · {atomId}
        </button>
      ) : null}
    </div>
  );
}

export function ReportView({ report }: { report: Report }) {
  const [selection, setSelection] = useState<EvidenceSelection | null>(null);

  const owned = new Set<string>(REPORT_MODES[report.mode].sections);
  const rendered = report.sections.filter((s) => owned.has(s.key));
  // The shell renders the iceberg and CTA itself, so they are not "missing".
  const shell = new Set<string>(SHELL_SECTIONS);
  const notInMode = report.sections.filter((s) => !owned.has(s.key) && !shell.has(s.key));

  return (
    <>
      <div style={{ display: "grid", gap: 26 }}>
        {rendered.map((section) => (
          <section key={section.key} aria-labelledby={`sec-${section.key}`}>
            <h2
              id={`sec-${section.key}`}
              className="mono"
              style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--brass)", margin: "0 0 10px" }}
            >
              {section.order}. {section.title}
            </h2>

            {isEmpty(section) ? (
              <p style={{ color: "var(--mut)", fontStyle: "italic", margin: 0, fontSize: 14, borderLeft: "2px dotted var(--line)", paddingLeft: 12 }}>
                {section.emptyReason}
              </p>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                {section.blocks.map((block, bi) => (
                  <div key={bi} style={{ display: "grid", gap: 12 }}>
                    {block.banner ? (
                      <p className="mono" style={{ fontSize: 12, color: "var(--brass-l)", margin: 0 }}>{block.banner}</p>
                    ) : null}
                    {block.title ? (
                      <h3 className="mono" style={{ fontSize: 12, color: "var(--paper-dim)", margin: 0 }}>{block.title}</h3>
                    ) : null}
                    {block.paragraphs.map((p, pi) => (
                      <Paragraph key={pi} p={p} onEvidence={setSelection} />
                    ))}
                    {block.warn ? (
                      <p
                        className="mono"
                        style={{ fontSize: 12.5, color: "var(--zinnober)", margin: 0, borderLeft: "2px solid var(--zinnober)", paddingLeft: 12, lineHeight: 1.5 }}
                      >
                        WARNHINWEIS: {block.warn}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {notInMode.length > 0 ? (
        <p style={{ color: "var(--mut)", fontSize: 12, marginTop: 26, lineHeight: 1.6 }}>
          Nicht Teil dieses Modus: {notInMode.map((s) => s.title).join(" · ")}.
        </p>
      ) : null}

      <EvidenceDrawer selection={selection} onClose={() => setSelection(null)} />
    </>
  );
}
