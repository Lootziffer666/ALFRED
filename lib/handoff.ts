import type { ContractFinding, Handoff, RepoEvidence } from "./schema";

export interface HandoffDraftInput {
  evidence: RepoEvidence;
  selectedFindings: ContractFinding[];
  objective: string;
}

function slug(text: string, index: number): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
  return `${base || "criterion"}-${index}`;
}

/**
 * Deterministic (no model call) handoff draft, built from findings the user
 * selected in the contract map. Kept template-based rather than model-generated
 * so unknowns stay unknowns instead of being silently resolved by an LLM
 * (PRD §5.5: "must not silently convert uncertainty into a design decision").
 */
export function buildHandoffDraft(input: HandoffDraftInput): Handoff {
  const { evidence, selectedFindings, objective } = input;
  const now = new Date().toISOString();

  const currentVerifiedState = selectedFindings.length
    ? selectedFindings
        .map((f) => `- [${f.status}] ${f.claim} (confidence ${f.confidence.toFixed(2)})`)
        .join("\n")
    : "- No findings were selected; verified state is limited to raw repository inventory.";

  const nonGoals = [
    "Do not refactor or restructure code unrelated to the objective below.",
    "Do not modify files that are not required to satisfy the acceptance criteria.",
    "Do not declare a criterion complete without pointing to the diff that satisfies it.",
  ];

  const gaps = selectedFindings.filter(
    (f) => f.status === "partially_implemented" || f.status === "documented_only" || f.status === "unclear",
  );
  const contradictions = selectedFindings.filter((f) => f.status === "contradicted");

  const acceptanceCriteria = [
    ...gaps.map((f, i) => ({
      id: slug(f.claim, i),
      text: `Close the gap for: "${f.claim}" (currently ${f.status}). ${f.missingProof ? `Missing proof: ${f.missingProof}.` : ""}`.trim(),
    })),
    ...contradictions.map((f, i) => ({
      id: slug(f.claim, gaps.length + i),
      text: `Resolve the contradiction for: "${f.claim}". Evidence against: ${f.evidenceAgainst.map((e) => e.source).join(", ") || "unspecified"}.`,
    })),
  ];

  if (acceptanceCriteria.length === 0) {
    acceptanceCriteria.push({
      id: "objective-primary",
      text: objective.trim() || "Deliver the objective described by the user with verifiable evidence.",
    });
  }

  const relevantFiles = [
    ...new Set(
      selectedFindings.flatMap((f) => [...f.evidenceFor, ...f.evidenceAgainst].map((e) => e.source.split(" · ")[0])),
    ),
  ];

  return {
    id: `handoff-${evidence.identity.owner}-${evidence.identity.name}-${Date.now()}`,
    repo: { owner: evidence.identity.owner, name: evidence.identity.name, ref: evidence.identity.ref },
    currentVerifiedState,
    objective: objective.trim() || "(objective not yet specified — fill in before export)",
    nonGoals,
    constraints: [
      "Follow the repository's existing stack and conventions; do not introduce a new framework without justification.",
      "Every acceptance criterion must be verifiable from the diff alone.",
    ],
    relevantFiles,
    deliverables: [
      "Source changes satisfying the acceptance criteria below.",
      "Tests or other verifiable evidence for each criterion.",
    ],
    acceptanceCriteria,
    requiredTestsAndEvidence: [
      "Point to the specific file(s) and line(s) that satisfy each acceptance criterion.",
      "Run and report the result of the repository's existing test/build commands, if any.",
    ],
    prohibitedChanges: [
      "No unrelated dependency upgrades.",
      "No deletion of existing documentation unless the objective explicitly requires it.",
    ],
    stopConditions: [
      "Stop and ask if an acceptance criterion is ambiguous rather than guessing at intent.",
      "Stop if satisfying a criterion would require an unsafe or destructive repository operation.",
    ],
    responseFormat:
      "Summarize changes per acceptance criterion, citing exact files/lines. State explicitly if any criterion was not completed.",
    sourceFindingIds: selectedFindings.map((f) => f.id),
    createdAt: now,
  };
}
