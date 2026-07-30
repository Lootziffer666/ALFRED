import type {
  AcceptanceCriterion,
  AcceptanceReport,
  ChangedFile,
  CriterionEvaluation,
  CriterionVerdict,
  EvidenceRef,
  Handoff,
  SubmittedChangeSource,
} from "./schema";

/**
 * Deterministic, network-free classification of a submitted diff against a
 * handoff's acceptance criteria (PRD §5.6 / §9: "Core classification and
 * audit logic must be testable without network access"). This intentionally
 * does not call a model: an LLM asked "is this done?" tends to agree with
 * confident phrasing, which is exactly the failure mode ALFRED exists to
 * catch. Evidence has to come from the diff itself.
 */

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "must", "should", "have",
  "from", "into", "when", "each", "every", "will", "shall", "does", "than",
  "then", "them", "they", "these", "those", "there", "which", "while",
  "about", "also", "such", "only", "both", "same", "over", "under", "more",
  "less", "some", "none", "your", "user", "users", "repository", "session",
]);

function extractFileMentions(text: string): string[] {
  const matches = text.match(/[\w][\w./-]*\.[a-zA-Z0-9]{1,6}\b/g) ?? [];
  return [...new Set(matches)];
}

function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 5 && !STOPWORDS.has(w));
  return [...new Set(words)];
}

function fileMatchesMention(filePath: string, mention: string): boolean {
  const normalizedMention = mention.replace(/^\.?\//, "");
  return filePath === normalizedMention || filePath.endsWith(`/${normalizedMention}`);
}

interface CriterionSignal {
  touchedNamedFiles: ChangedFile[];
  keywordHitFiles: ChangedFile[];
  touchedProhibited: ChangedFile[];
}

function analyzeCriterion(
  criterion: AcceptanceCriterion,
  handoff: Handoff,
  changedFiles: ChangedFile[],
): CriterionSignal {
  const namedFiles = extractFileMentions(criterion.text);
  const keywords = extractKeywords(criterion.text);

  const touchedNamedFiles = changedFiles.filter((f) =>
    namedFiles.some((m) => fileMatchesMention(f.path, m)),
  );

  const keywordHitFiles = changedFiles.filter((f) => {
    const haystack = `${f.path}\n${f.patchExcerpt ?? ""}`.toLowerCase();
    return keywords.some((k) => haystack.includes(k));
  });

  const touchedProhibited = changedFiles.filter((f) =>
    handoff.prohibitedChanges.some((p) => extractFileMentions(p).some((m) => fileMatchesMention(f.path, m))),
  );

  return { touchedNamedFiles, keywordHitFiles, touchedProhibited };
}

function toEvidenceRefs(files: ChangedFile[]): EvidenceRef[] {
  return files.map((f) => ({ source: `${f.path} · ${f.status} (+${f.additions}/-${f.deletions})` }));
}

function classifyCriterion(
  criterion: AcceptanceCriterion,
  handoff: Handoff,
  changedFiles: ChangedFile[],
): CriterionEvaluation {
  const signal = analyzeCriterion(criterion, handoff, changedFiles);

  if (signal.touchedProhibited.length > 0) {
    return {
      criterionId: criterion.id,
      criterionText: criterion.text,
      verdict: "failed",
      evidence: toEvidenceRefs(signal.touchedProhibited),
      note: "The diff touches files the handoff explicitly listed as prohibited or out of scope.",
    };
  }

  if (signal.touchedNamedFiles.length > 0 && signal.keywordHitFiles.length > 0) {
    return {
      criterionId: criterion.id,
      criterionText: criterion.text,
      verdict: "passed",
      evidence: toEvidenceRefs([...new Set([...signal.touchedNamedFiles, ...signal.keywordHitFiles])]),
      note: "The diff modifies the specific file(s) this criterion names and contains matching keywords from the criterion text.",
    };
  }

  // Deliberately does NOT fall back to "any handoff-relevant file changed" as
  // evidence: that signal is shared across every criterion and would make
  // every criterion in a handoff look equally (weakly) supported regardless
  // of relevance. Only criterion-specific signals count here.
  const specificEvidence = [...new Set([...signal.touchedNamedFiles, ...signal.keywordHitFiles])];
  if (specificEvidence.length > 0) {
    return {
      criterionId: criterion.id,
      criterionText: criterion.text,
      verdict: "partially_passed",
      evidence: toEvidenceRefs(specificEvidence),
      note: "The diff touches a file or contains a keyword tied to this criterion, but not both — evidence is incomplete.",
    };
  }

  if (namedButUntouched(criterion)) {
    return {
      criterionId: criterion.id,
      criterionText: criterion.text,
      verdict: "not_applicable",
      evidence: [],
      note: "This criterion cannot be evaluated from file-level diff evidence (e.g. it describes an absence, a process, or a non-code property).",
    };
  }

  return {
    criterionId: criterion.id,
    criterionText: criterion.text,
    verdict: "not_proven",
    evidence: [],
    note: "No file in the submitted diff provides direct evidence for this criterion. A claim of completion is not sufficient on its own.",
  };
}

const NON_CODE_HINTS = ["must not", "never", "no repository write", "no write operation", "process", "workflow"];

function namedButUntouched(criterion: AcceptanceCriterion): boolean {
  const lower = criterion.text.toLowerCase();
  return NON_CODE_HINTS.some((hint) => lower.includes(hint));
}

const COMPLETION_CLAIM_PATTERN = /\b(done|complete|completed|implemented|fixed|finished|resolved)\b/i;

function findUnsupportedClaims(
  agentSummary: string | undefined,
  evaluations: CriterionEvaluation[],
): string[] {
  if (!agentSummary?.trim()) return [];
  const unsupported: string[] = [];
  const lines = agentSummary
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (!COMPLETION_CLAIM_PATTERN.test(line)) continue;
    const matchingCriterion = evaluations.find((ev) =>
      overlapsSignificantly(line.toLowerCase(), ev.criterionText.toLowerCase()),
    );
    if (
      matchingCriterion &&
      matchingCriterion.verdict !== "passed" &&
      matchingCriterion.verdict !== "not_applicable"
    ) {
      unsupported.push(
        `Agent claim "${line}" asserts completion, but criterion "${matchingCriterion.criterionText}" is classified as ${matchingCriterion.verdict}.`,
      );
    }
  }
  return unsupported;
}

function overlapsSignificantly(a: string, b: string): boolean {
  const aWords = new Set(extractKeywords(a));
  const bWords = extractKeywords(b);
  if (bWords.length === 0) return false;
  const overlap = bWords.filter((w) => aWords.has(w)).length;
  return overlap / bWords.length >= 0.3;
}

export interface BuildAcceptanceReportInput {
  handoff: Handoff;
  changedFiles: ChangedFile[];
  source: SubmittedChangeSource;
  agentSummary?: string;
}

export function buildAcceptanceReport(input: BuildAcceptanceReportInput): AcceptanceReport {
  const { handoff, changedFiles, source, agentSummary } = input;
  const criteria = handoff.acceptanceCriteria.map((c) => classifyCriterion(c, handoff, changedFiles));
  const unsupportedClaims = findUnsupportedClaims(agentSummary, criteria);

  const counts = criteria.reduce<Record<CriterionVerdict, number>>(
    (acc, c) => {
      acc[c.verdict]++;
      return acc;
    },
    { passed: 0, partially_passed: 0, failed: 0, not_proven: 0, not_applicable: 0 },
  );

  const summary =
    `${counts.passed} passed, ${counts.partially_passed} partially passed, ${counts.failed} failed, ` +
    `${counts.not_proven} not proven, ${counts.not_applicable} not applicable, across ${changedFiles.length} changed file(s).` +
    (unsupportedClaims.length > 0
      ? ` ${unsupportedClaims.length} agent claim(s) were not supported by the diff.`
      : "");

  return {
    handoffId: handoff.id,
    source,
    generatedAt: new Date().toISOString(),
    changedFiles,
    criteria,
    unsupportedClaims,
    summary,
  };
}
