import type { ContractFinding, ContractMap, RepoEvidence } from "../schema";
import { parseUnifiedDiff } from "../github";
import { buildHandoffDraft } from "../handoff";
import { buildAcceptanceReport } from "../audit";

/**
 * Deterministic demo-mode data (PRD §8). Nothing here touches the network;
 * the contract map, handoff and acceptance report below are produced by the
 * *real* handoff/audit logic (buildHandoffDraft / buildAcceptanceReport),
 * not hand-typed results, so demo mode exercises the actual application
 * logic rather than acting as a static mockup.
 */

export const demoRepoEvidence: RepoEvidence = {
  identity: {
    owner: "octo",
    name: "widget-kit",
    ref: "main",
    url: "https://github.com/octo/widget-kit",
    defaultBranch: "main",
    description: "Reusable pricing/widget components for the storefront.",
    private: false,
  },
  fetchedAt: "2026-01-15T09:00:00.000Z",
  tree: {
    status: "loaded",
    data: [
      { path: "README.md", type: "file", size: 3120 },
      { path: "PLAN.md", type: "file", size: 1780 },
      { path: "package.json", type: "file", size: 640 },
      { path: ".github/workflows/ci.yml", type: "file", size: 512 },
      { path: "src", type: "dir" },
      { path: "src/index.ts", type: "file", size: 220 },
      { path: "src/calculator.ts", type: "file", size: 1890 },
      { path: "src/calculator.test.ts", type: "file", size: 940 },
      { path: "src/legacy.ts", type: "file", size: 2210 },
      { path: "docs/architecture.md", type: "file", size: 4400 },
    ],
  },
  docs: {
    status: "loaded",
    data: [
      {
        path: "README.md",
        truncated: false,
        fullLength: 640,
        excerpt:
          "# widget-kit\n\nPricing widgets for the storefront.\n\n## Testing\n\nThe suite has 100% test coverage. Run `npm test`.\n\n## Build\n\n`npm run build` produces dist/.",
      },
      {
        path: "PLAN.md",
        truncated: false,
        fullLength: 420,
        excerpt:
          "# Plan\n\n- [ ] Discount codes: allow percentage and flat discounts on checkout (planned, not started)\n- [x] Base price calculator\n- [ ] Rate limiting for the public pricing API",
      },
    ],
  },
  packageManifest: {
    status: "loaded",
    data: {
      path: "package.json",
      detectedStack: ["TypeScript", "Vitest"],
      packageManager: "npm",
      scripts: { build: "tsc -p .", test: "vitest run", lint: "eslint ." },
    },
  },
  commits: {
    status: "loaded",
    data: [
      { sha: "a1b2c3d4e5f6", message: "Add base price calculator", author: "codeowner", date: "2026-01-10T12:00:00.000Z", url: "https://github.com/octo/widget-kit/commit/a1b2c3d4e5f6" },
      { sha: "b2c3d4e5f6a1", message: "Wire up CI workflow", author: "codeowner", date: "2026-01-11T09:30:00.000Z", url: "https://github.com/octo/widget-kit/commit/b2c3d4e5f6a1" },
      { sha: "c3d4e5f6a1b2", message: "Document plan for discount codes", author: "codeowner", date: "2026-01-12T15:10:00.000Z", url: "https://github.com/octo/widget-kit/commit/c3d4e5f6a1b2" },
    ],
  },
  pullRequests: {
    status: "loaded",
    data: {
      openCount: 1,
      recent: [{ number: 6, title: "WIP: discount codes", state: "open", url: "https://github.com/octo/widget-kit/pull/6" }],
    },
  },
  issues: { status: "loaded", data: { openCount: 3 } },
  warnings: ["docs/architecture.md was fetched but exceeds excerpt limits for some sections; only the first portion is included."],
};

export const demoContractFindings: ContractFinding[] = [
  {
    id: "build-script-present",
    claim: "The project builds via the documented `npm run build` script.",
    status: "implemented",
    evidenceFor: [{ source: "package.json · scripts.build" }],
    evidenceAgainst: [],
    confidence: 0.85,
    explanation: "package.json defines a build script matching the README instructions.",
    missingProof: null,
  },
  {
    id: "ci-lints-and-tests",
    claim: "CI lints and tests on every push.",
    status: "implemented",
    evidenceFor: [{ source: ".github/workflows/ci.yml" }],
    evidenceAgainst: [],
    confidence: 0.8,
    explanation: "A CI workflow file exists at the standard path.",
    missingProof: null,
  },
  {
    id: "discount-test-coverage",
    claim: "The test suite covers the discount calculation path.",
    status: "partially_implemented",
    evidenceFor: [{ source: "src/calculator.test.ts" }],
    evidenceAgainst: [{ source: "README.md · Testing section" }],
    confidence: 0.45,
    explanation: "A test file exists for the calculator, but nothing in it references discount codes.",
    missingProof: "A test case exercising percentage/flat discount codes.",
  },
  {
    id: "discount-codes-implemented",
    claim: "The discount codes feature described in PLAN.md is implemented.",
    status: "documented_only",
    evidenceFor: [],
    evidenceAgainst: [{ source: "PLAN.md · discount codes item" }],
    confidence: 0.2,
    explanation: "PLAN.md lists discount codes as planned and unchecked; no corresponding source file was found.",
    missingProof: "A source file implementing discount-code calculation, e.g. src/calculator.discount.ts.",
  },
  {
    id: "full-test-coverage-claim",
    claim: "README's claim of 100% test coverage.",
    status: "contradicted",
    evidenceFor: [],
    evidenceAgainst: [{ source: "package.json · scripts.test" }, { source: "src/legacy.ts" }],
    confidence: 0.6,
    explanation: "src/legacy.ts has no matching test file, which contradicts a blanket 100% coverage claim.",
    missingProof: "A coverage report or a test file for src/legacy.ts.",
  },
  {
    id: "rate-limiting-implemented",
    claim: "Rate limiting for the public pricing API is implemented.",
    status: "unclear",
    evidenceFor: [],
    evidenceAgainst: [],
    confidence: 0.3,
    explanation: "PLAN.md lists rate limiting as an open item; no middleware or rate-limit code was found in the tree, but the tree may be incomplete.",
    missingProof: "Source file or dependency implementing rate limiting.",
  },
  {
    id: "legacy-v1-compat",
    claim: "A legacy v1 API compatibility layer is required.",
    status: "out_of_scope",
    evidenceFor: [],
    evidenceAgainst: [],
    confidence: 0.1,
    explanation: "Nothing in the evidence suggests a v1 API contract exists; this claim does not apply to this repository.",
    missingProof: null,
  },
];

export const demoContractMap: ContractMap = {
  modelId: "demo/deterministic-fixture",
  generatedAt: "2026-01-15T09:05:00.000Z",
  findings: demoContractFindings,
};

const selectedForHandoff = demoContractFindings.filter((f) =>
  ["partially_implemented", "documented_only", "contradicted", "unclear"].includes(f.status),
);

export const demoHandoff = buildHandoffDraft({
  evidence: demoRepoEvidence,
  selectedFindings: selectedForHandoff,
  objective:
    "Implement discount codes end to end, add matching tests, and correct or substantiate the README's test-coverage claim.",
});

export const demoDiffText = `diff --git a/PLAN.md b/PLAN.md
index 1111111..2222222 100644
--- a/PLAN.md
+++ b/PLAN.md
@@ -1,4 +1,4 @@
 # Plan

-- [ ] Discount codes: allow percentage and flat discounts on checkout (planned, not started)
+- [x] Discount codes: allow percentage and flat discounts on checkout (implemented in src/calculator.discount.ts)
 - [x] Base price calculator
diff --git a/src/calculator.discount.ts b/src/calculator.discount.ts
new file mode 100644
index 0000000..3333333
--- /dev/null
+++ b/src/calculator.discount.ts
@@ -0,0 +1,12 @@
+export type DiscountCode = { kind: "percent" | "flat"; value: number };
+
+export function applyDiscountCode(price: number, code: DiscountCode): number {
+  if (code.kind === "percent") {
+    return Math.max(0, price * (1 - code.value / 100));
+  }
+  return Math.max(0, price - code.value);
+}
`;

export const demoChangedFiles = parseUnifiedDiff(demoDiffText);

export const demoAgentSummary = `Implemented discount codes end to end, all done.
Fixed the README's 100% test coverage claim by adding coverage for legacy.ts.`;

export const demoAcceptanceReport = buildAcceptanceReport({
  handoff: demoHandoff,
  changedFiles: demoChangedFiles,
  source: { kind: "demo_fixture" },
  agentSummary: demoAgentSummary,
});
