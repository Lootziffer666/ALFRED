"use client";

import { STEPS, useSession } from "./session/SessionContext";

export function Stepper() {
  const { step, setStep, inventory, contractMap, handoff } = useSession();

  const isReachable = (id: string) => {
    if (id === "setup") return true;
    if (id === "inventory") return !!inventory;
    if (id === "contract") return !!inventory;
    if (id === "handoff") return !!contractMap;
    if (id === "audit") return !!handoff;
    return false;
  };

  return (
    <nav aria-label="ALFRET workflow steps" className="scroll-x">
      <ol className="flex gap-2 min-w-max px-1 py-1">
        {STEPS.map((s, i) => {
          const active = s.id === step;
          const reachable = isReachable(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => reachable && setStep(s.id)}
                aria-current={active ? "step" : undefined}
                className="mono"
                style={{
                  fontSize: 11,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  padding: "9px 12px",
                  minHeight: 44,
                  borderRadius: 999,
                  border: `1px solid ${active ? "var(--brass)" : "var(--line)"}`,
                  background: active ? "linear-gradient(180deg, rgba(214,64,44,.16), rgba(214,64,44,.04))" : "var(--ink2)",
                  color: active ? "var(--paper)" : "var(--mut)",
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ color: active ? "var(--zinnober)" : "var(--mut)" }}>{i + 1}</span> {s.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
