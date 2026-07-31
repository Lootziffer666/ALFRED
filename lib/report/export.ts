import { REPORT_MODES, isReportMode, type Report, type ReportMode } from "./modes";
import { SHELL_SECTIONS } from "./structure";
import type { SignalSource } from "./signals";

/**
 * Export and sharing (plan §8.8). The demo persists nothing: a share link
 * carries only repository, ref and mode, and the report is rebuilt when the
 * link is opened. Exports are produced in the browser from the report already
 * on screen.
 */

export interface ExportInput {
  report: Report;
  sources?: SignalSource[];
  warnings?: string[];
}

export interface ShareParams {
  repo: string;
  ref?: string;
  mode: Report["mode"];
  level: Report["level"];
}

export function shareParamsOf(report: Report): ShareParams {
  return {
    repo: `${report.repo.owner}/${report.repo.name}`,
    ref: report.repo.ref,
    mode: report.mode,
    level: report.level,
  };
}

/** A link that reproduces the run — it carries no report content. */
export function shareQuery(report: Report): string {
  const p = shareParamsOf(report);
  const query = new URLSearchParams({ repo: p.repo, mode: p.mode, level: String(p.level) });
  if (p.ref) query.set("ref", p.ref);
  return `?${query.toString()}`;
}

export interface SharedRun {
  repo: string;
  ref: string;
  mode: ReportMode;
  level: 1 | 2 | 3 | 4;
}

function parseLevel(raw: string | null): 1 | 2 | 3 | 4 | null {
  const n = Number(raw);
  return n === 1 || n === 2 || n === 3 || n === 4 ? n : null;
}

/**
 * Reads a share link back into a run. An unknown or not-yet-implemented mode
 * falls back to the default rather than failing the whole link.
 */
export function parseShareParams(params: URLSearchParams, fallback: ReportMode): SharedRun | null {
  const repo = params.get("repo");
  if (!repo) return null;

  const raw = params.get("mode");
  const mode = isReportMode(raw) && REPORT_MODES[raw].status === "implemented" ? raw : fallback;
  return {
    repo,
    ref: params.get("ref") ?? "",
    mode,
    level: parseLevel(params.get("level")) ?? REPORT_MODES[mode].defaultLevel,
  };
}

function renderedSections(report: Report) {
  const shell = new Set<string>(SHELL_SECTIONS);
  const owned = new Set<string>(REPORT_MODES[report.mode].sections);
  return report.sections.filter((s) => owned.has(s.key) && !shell.has(s.key));
}

export function reportToMarkdown({ report, sources = [], warnings = [] }: ExportInput): string {
  const spec = REPORT_MODES[report.mode];
  const out: string[] = [];

  out.push(`# ALFRET · ${spec.label} — ${report.repo.owner}/${report.repo.name}`);
  out.push("");
  out.push(`Ref: ${report.repo.ref ?? "(Standardbranch)"} · Tonstufe ${report.level} · erzeugt ${report.createdAt}`);
  out.push("");
  out.push(`> ${report.assessment.headline}`);
  out.push("");

  for (const section of renderedSections(report)) {
    out.push(`## ${section.order}. ${section.title}`);
    out.push("");
    if (section.blocks.every((b) => b.paragraphs.length === 0)) {
      out.push(`_${section.emptyReason ?? "Leer."}_`);
      out.push("");
      continue;
    }
    for (const block of section.blocks) {
      if (block.banner) out.push(`_${block.banner}_`, "");
      for (const p of block.paragraphs) {
        out.push(p.text);
        if (p.cls === "cue-hyp" && p.tags.length) out.push(`  \n_Hypothese: ${p.tags.map((t) => t.label).join(", ")}_`);
        if (p.evidence.length) {
          out.push("");
          for (const e of p.evidence) out.push(`  - **${e.k}** — ${e.v}`);
        }
        out.push("");
      }
      if (block.warn) out.push(`**WARNHINWEIS:** ${block.warn}`, "");
    }
  }

  out.push("## Was nicht beurteilt wurde");
  out.push("");
  for (const u of report.assessment.unknowns) out.push(`- ${u}`);
  out.push("");

  if (sources.length) {
    out.push("## Quellenlage");
    out.push("");
    for (const s of sources) {
      const detail = s.status === "loaded" ? `${s.paths.join(", ")} (${s.chars} Zeichen)` : (s.reason ?? "");
      out.push(`- **${s.label}** — ${s.status}${detail ? `: ${detail}` : ""}`);
    }
    out.push("");
  }

  if (warnings.length) {
    out.push("## Warnungen beim Abruf");
    out.push("");
    for (const w of warnings) out.push(`- ${w}`);
    out.push("");
  }

  return out.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function reportToHtml(input: ExportInput): string {
  const { report } = input;
  const spec = REPORT_MODES[report.mode];
  const title = `ALFRET · ${spec.label} — ${report.repo.owner}/${report.repo.name}`;

  const body = renderedSections(report)
    .map((section) => {
      const heading = `<h2>${section.order}. ${escapeHtml(section.title)}</h2>`;
      if (section.blocks.every((b) => b.paragraphs.length === 0)) {
        return `${heading}<p class="empty">${escapeHtml(section.emptyReason ?? "Leer.")}</p>`;
      }
      const blocks = section.blocks
        .map((block) => {
          const paragraphs = block.paragraphs
            .map((p) => {
              const evidence = p.evidence.length
                ? `<ul class="evidence">${p.evidence
                    .map((e) => `<li><b>${escapeHtml(e.k)}</b> — ${escapeHtml(e.v)}</li>`)
                    .join("")}</ul>`
                : "";
              const hyp =
                p.cls === "cue-hyp" && p.tags.length
                  ? `<p class="hyp">Hypothese: ${escapeHtml(p.tags.map((t) => t.label).join(", "))}</p>`
                  : "";
              return `<p class="${p.cls}">${escapeHtml(p.text)}</p>${hyp}${evidence}`;
            })
            .join("");
          const warn = block.warn ? `<p class="warn">WARNHINWEIS: ${escapeHtml(block.warn)}</p>` : "";
          return paragraphs + warn;
        })
        .join("");
      return heading + blocks;
    })
    .join("\n");

  const unknowns = report.assessment.unknowns.map((u) => `<li>${escapeHtml(u)}</li>`).join("");

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
body{max-width:44rem;margin:2rem auto;padding:0 1rem;font:16px/1.6 Georgia,serif;color:#1a1a1a;background:#f6f2e8}
h1{font-size:1.5rem} h2{font-size:.8rem;letter-spacing:.14em;text-transform:uppercase;color:#7d5e29;margin-top:2rem}
p{margin:.6rem 0} .cue-ok{border-left:2px solid #7fae6a;padding-left:.75rem}
.cue-hyp{border-left:2px dashed #8b91a0;padding-left:.75rem;color:#4a4a4a}
.cue-notag{border-left:2px dashed #b78a3e;padding-left:.75rem}
.hyp,.empty{font-size:.85rem;color:#666;font-style:italic}
.warn{color:#9c2f44;font-weight:bold}
.evidence{font:12px ui-monospace,monospace;color:#555;margin:.25rem 0 1rem .75rem}
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p><i>${escapeHtml(report.assessment.headline)}</i></p>
<p class="evidence">Ref: ${escapeHtml(report.repo.ref ?? "(Standardbranch)")} · Tonstufe ${report.level} · erzeugt ${escapeHtml(report.createdAt)}</p>
${body}
<h2>Was nicht beurteilt wurde</h2>
<ul class="evidence">${unknowns}</ul>
</body>
</html>`;
}

export function reportToJson(input: ExportInput): string {
  return JSON.stringify(
    { report: input.report, sources: input.sources ?? [], warnings: input.warnings ?? [] },
    null,
    2,
  );
}
