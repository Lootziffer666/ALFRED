"use client";

import { useState } from "react";
import type { Report } from "@/lib/report/modes";
import type { SignalSource } from "@/lib/report/signals";
import { reportToHtml, reportToJson, reportToMarkdown, shareQuery } from "@/lib/report/export";

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportBar({
  report,
  sources,
  warnings,
}: {
  report: Report;
  sources: SignalSource[];
  warnings: string[];
}) {
  const [copied, setCopied] = useState(false);
  const base = `${report.repo.owner}-${report.repo.name}-${report.mode}`;
  const input = { report, sources, warnings };

  async function copyShareLink() {
    const link = `${window.location.origin}${window.location.pathname}${shareQuery(report)}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Link kopieren:", link);
    }
  }

  return (
    <div className="card" style={{ padding: 14, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => download(`${base}.md`, reportToMarkdown(input), "text/markdown")}>
          ⧉ Markdown
        </button>
        <button type="button" onClick={() => download(`${base}.html`, reportToHtml(input), "text/html")}>
          ⧉ HTML
        </button>
        <button type="button" onClick={() => download(`${base}.json`, reportToJson(input), "application/json")}>
          ⧉ JSON
        </button>
        <button type="button" className="ghost" onClick={copyShareLink}>
          {copied ? "Link kopiert" : "⧉ Link teilen"}
        </button>
      </div>
      <p className="mono" style={{ fontSize: 11, color: "var(--mut)", margin: 0, lineHeight: 1.5 }}>
        Der Link enthält nur Repository, Ref und Modus — der Bericht wird beim Öffnen neu erzeugt.
        Nichts davon liegt auf einem Server.
      </p>
    </div>
  );
}
