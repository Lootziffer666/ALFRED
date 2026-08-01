/**
 * Demo-Endpunkt (Etappe 11b).
 * Zeigt einen kompletten Zyklus: Plan → Hermes → CUE → Maid
 */

import { NextRequest, NextResponse } from "next/server";
import { InMemoryHermesDispatcher } from "@/lib/hermes";
import { MemoryAlfretStore } from "@/lib/store";
import { makeStaticCueCheck, buildCueReport } from "@/lib/cue";
import { classifyPath } from "@/lib/maid/classify";
import type { SignedExecutionPlan } from "@/lib/schema/homelab";

function createDemoPlan(): SignedExecutionPlan {
  return {
    planId: `plan-demo-${Date.now()}`,
    nodeId: "workstation",
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    nonce: `demo-nonce-${Math.random()}`,
    steps: [
      {
        adapterId: "probe",
        adapterVersion: "1.0.0",
        kind: "probe-node",
        params: {},
      },
    ],
    artifactHashes: {},
    signerKeyId: "demo-key",
    signature: "demo-signature",
  };
}

export async function POST(req: NextRequest) {
  try {
    const store = new MemoryAlfretStore();
    const dispatcher = new InMemoryHermesDispatcher();

    // ── Schritt 1: Plan einreichen ──────────────────────────────────────────
    const plan = createDemoPlan();
    const order = await dispatcher.submit(plan);
    await store.setOrder(order);

    // ── Schritt 2: Session simulieren ───────────────────────────────────────
    const taskId = `task-demo-${Date.now()}`;
    const now = new Date().toISOString();

    // Mock: Simulator setzt Session auf "verifying" (vereinfacht)
    // In der Realität würde der Runner dies tun
    const mockSession = {
      sessionId: order.orderId,
      agentId: `agent-demo-${Math.random()}`,
      taskId,
      planId: plan.planId,
      nodeId: "workstation",
      phase: "verifying" as const,
      headSha: "abc123def456",
      worktree: "worktrees/demo",
      leaseExpiresAt: new Date(Date.now() + 600_000).toISOString(),
      startedAt: now,
      updatedAt: now,
      terminatedAt: null,
    };
    await store.setSession(mockSession);

    // ── Schritt 3: CUE-Verifikation ────────────────────────────────────────
    // Statische Checks für Demo
    const cueChecks = [
      makeStaticCueCheck(
        "schema-fidelity",
        "passed",
        "Output-Format stimmt mit Contract überein",
        ["runner/src/adapters.ts"],
      ),
      makeStaticCueCheck(
        "regression",
        "passed",
        "Alle bestehenden Tests bestanden",
        ["tests/adapters.test.ts"],
      ),
      makeStaticCueCheck(
        "no-placeholders",
        "passed",
        "Keine unimplementierten Platzhalter",
        [],
      ),
    ];

    const cueReport = buildCueReport(taskId, plan.planId, cueChecks);
    await store.setCueReport(cueReport);

    // ── Schritt 4: Maid-Scanning ───────────────────────────────────────────
    // Demo-Dateien klassifizieren
    const demoFiles = [
      "lib/store/types.ts",
      "lib/store/memory.ts",
      "lib/store/sqlite.ts",
      "tests/store.test.ts",
      ".gitignore",
      "node_modules/.cache/build",
    ];

    const classifiedFiles: Record<string, string> = {};
    for (const file of demoFiles) {
      classifiedFiles[file] = classifyPath(file);
    }

    const maidReport = {
      repository: "lootziffer666/alfred",
      commitSha: "abc123def456",
      findings: [],
      proposals: [],
      classifiedFiles,
      runAt: now,
    };
    await store.setMaidReport(maidReport);

    // ── Schritt 5: Zusammenfassung zurückgeben ─────────────────────────────
    const sessions = await store.listSessions();
    const cueReports = await store.listCueReports(plan.planId);

    return NextResponse.json({
      success: true,
      demo: {
        planId: plan.planId,
        orderId: order.orderId,
        taskId,
        order: {
          state: order.state,
          attempts: order.attempts,
        },
        session: {
          phase: mockSession.phase,
          worktree: mockSession.worktree,
          headSha: mockSession.headSha,
        },
        cueReport: {
          overall: cueReport.overall,
          blocksRelease: cueReport.blocksRelease,
          checks: cueReport.checks.length,
        },
        maidReport: {
          classifiedFilesCount: Object.keys(maidReport.classifiedFiles).length,
          findings: maidReport.findings.length,
          proposals: maidReport.proposals.length,
        },
      },
      storedCount: {
        sessions: sessions.length,
        cueReports: cueReports.length,
      },
    });
  } catch (error) {
    console.error("Demo endpoint error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
