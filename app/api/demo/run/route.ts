/**
 * Demo-Endpunkt (Etappe 11b + 12b).
 * Zeigt einen kompletten Zyklus: Plan → Hermes → CUE → Maid
 * Mit Demo-Policy-Enforcement (Etappe 12b)
 */

import { NextRequest, NextResponse } from "next/server";
import { InMemoryHermesDispatcher } from "@/lib/hermes";
import { makeStaticCueCheck, buildCueReport } from "@/lib/cue";
import { classifyPath } from "@/lib/maid/classify";
import type { FileClass } from "@/lib/maid/types";
import { broadcaster } from "@/lib/sse/broadcaster";
import { generateKeyPair, signPlan } from "@/lib/homelab/signing";
import type { SignedExecutionPlan } from "@/lib/schema/homelab";
import { resolveOperatingProfile } from "@/lib/profile/operating";
import { checkDemoPolicy, withDemoTimeout, DemoPolicyError } from "@/lib/demo/policy";

// Das Profil kommt aus der Serverumgebung, nicht aus dem Request — siehe
// lib/profile/operating.ts.

async function createDemoPlan(repoUrl: string, privateKey: string, keyId: string): Promise<SignedExecutionPlan> {
  const unsignedPlan = {
    planId: `plan-demo-${Date.now()}`,
    nodeId: "demo-node",
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    nonce: `demo-nonce-${Math.random()}`,
    steps: [
      {
        kind: "probe-node" as const,
        adapterId: "github-scout",
        adapterVersion: "0.1.0",
        params: { repoUrl },
      },
    ],
    artifactHashes: [],
    signerKeyId: keyId,
  };

  return signPlan(unsignedPlan, privateKey);
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody || "{}") as Record<string, unknown>;
    const repoUrl: string =
      typeof body?.repoUrl === "string" && body.repoUrl.length > 0
        ? body.repoUrl
        : "https://github.com/Lootziffer666/ALFRED";

    const profile = resolveOperatingProfile();

    // ── Policy-Check ────────────────────────────────────────────────────────
    const violations = checkDemoPolicy(
      {
        repoUrl,
        nodeId: typeof body?.nodeId === "string" ? body.nodeId : undefined,
        executor: typeof body?.executor === "string" ? body.executor : undefined,
        rawBody,
        bodySizeBytes: new TextEncoder().encode(rawBody).length,
      },
      profile,
    );

    if (violations.length > 0) {
      return NextResponse.json(
        { ok: false, violations, error: violations[0].message },
        { status: 422 },
      );
    }

    // ── Ausführung mit Timeout ───────────────────────────────────────────────
    const keyPair = await generateKeyPair();
    const dispatcher = new InMemoryHermesDispatcher(keyPair.publicKey);

    const result = await withDemoTimeout(async () => {
      // ── Schritt 1: Plan einreichen ──────────────────────────────────────────
      const plan = await createDemoPlan(repoUrl, keyPair.privateKey, keyPair.keyId);
      const order = await dispatcher.submit(plan);
      broadcaster.broadcast("order-update", {
        orderId: order.orderId,
        state: order.state,
      });

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
        nodeId: "demo-node",
        phase: "verifying" as const,
        headSha: "abc123def456",
        worktree: "worktrees/demo",
        leaseExpiresAt: new Date(Date.now() + 600_000).toISOString(),
        startedAt: now,
        updatedAt: now,
        terminatedAt: null,
      };
      broadcaster.broadcast("session-update", {
        sessionId: mockSession.sessionId,
        phase: mockSession.phase,
      });

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
      broadcaster.broadcast("supervisor-tick", {
        taskId,
        planId: plan.planId,
        decision: "proceed",
      });

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

      const classifiedFiles: Record<string, FileClass> = {};
      for (const file of demoFiles) {
        classifiedFiles[file] = classifyPath(file, 0);
      }

      const maidReport = {
        repository: "lootziffer666/alfred",
        commitSha: "abc123def456",
        findings: [],
        proposals: [],
        classifiedFiles,
        runAt: now,
      };
      broadcaster.broadcast("heartbeat", {
        agentId: mockSession.agentId,
        status: "maid-scan-complete",
      });

      // ── Schritt 5: Zusammenfassung zurückgeben ─────────────────────────────
      return {
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
      };
    });

    return NextResponse.json({
      ok: true,
      demo: result,
    });
  } catch (err) {
    if (err instanceof DemoPolicyError) {
      return NextResponse.json({ ok: false, error: err.message, kind: err.kind }, { status: 422 });
    }

    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
