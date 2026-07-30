"use client";

import { SessionProvider, useSession } from "@/components/session/SessionContext";
import { Stepper } from "@/components/Stepper";
import { SessionSetupScreen } from "@/components/screens/SessionSetupScreen";
import { InventoryScreen } from "@/components/screens/InventoryScreen";
import { ContractMapScreen } from "@/components/screens/ContractMapScreen";
import { HandoffScreen } from "@/components/screens/HandoffScreen";
import { AuditScreen } from "@/components/screens/AuditScreen";

function Screen() {
  const { step } = useSession();
  switch (step) {
    case "setup":
      return <SessionSetupScreen />;
    case "inventory":
      return <InventoryScreen />;
    case "contract":
      return <ContractMapScreen />;
    case "handoff":
      return <HandoffScreen />;
    case "audit":
      return <AuditScreen />;
  }
}

function AppShell() {
  const { demoMode } = useSession();
  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "16px 14px 48px", width: "100%" }}>
      <header style={{ marginBottom: 16 }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: "0.15em", color: "var(--bordeaux)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 8 }}>
          <span className="dot" style={{ background: "var(--zinnober)" }} />
          ALFRED · Evidence-first repository butler
          {demoMode && <span className="pill" style={{ color: "var(--brass-l)", borderColor: "var(--brass-d)" }}>demo mode</span>}
        </div>
        <h1 style={{ fontSize: "clamp(28px, 6vw, 40px)", margin: "6px 0 0", lineHeight: 1.05 }}>
          Prepare the task. <span style={{ color: "var(--zinnober)" }}>Audit the result.</span>
        </h1>
        <p className="serif" style={{ color: "var(--paper-dim)", fontSize: 14, maxWidth: "60ch", marginTop: 8 }}>
          ALFRED inspects a repository before you hand it to a coding agent, and checks the agent&apos;s work
          against evidence afterward — no completion claim is trusted on its own.
        </p>
      </header>

      <div style={{ marginBottom: 16 }}>
        <Stepper />
      </div>

      <Screen />
    </div>
  );
}

export default function Home() {
  return (
    <SessionProvider>
      <AppShell />
    </SessionProvider>
  );
}
