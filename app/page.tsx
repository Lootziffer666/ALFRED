"use client";

import { SessionProvider, useSession } from "@/components/session/SessionContext";
import { AppShell } from "@/components/shell/AppShell";
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

function AppBody() {
  const { demoMode } = useSession();
  return (
    <AppShell>
      <header className="mb-8">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span
            className="w-1.5 h-1.5 rounded-full bg-primary"
            style={{ boxShadow: "0 0 6px color-mix(in srgb, var(--live-accent) 70%, transparent)" }}
          />
          <span className="font-technical-data text-[10px] text-on-surface-variant uppercase tracking-widest">
            Uplink Active
          </span>
          {demoMode && (
            <span className="font-technical-data text-[10px] text-tertiary uppercase tracking-widest border border-tertiary/30 rounded-full px-2 py-0.5">
              Demo Mode
            </span>
          )}
        </div>
        <h1 className="font-document-heading text-[clamp(28px,6vw,42px)] font-bold text-on-surface leading-tight">
          Prepare the task. <span className="text-primary">Audit the result.</span>
        </h1>
        <p className="font-body-md text-on-surface-variant text-sm max-w-[60ch] mt-2 italic">
          ALFRET inspects a repository before you hand it to a coding agent, and checks the agent&apos;s work
          against evidence afterward — no completion claim is trusted on its own.
        </p>
      </header>

      <Screen />
    </AppShell>
  );
}

export default function Home() {
  return (
    <SessionProvider>
      <AppBody />
    </SessionProvider>
  );
}
