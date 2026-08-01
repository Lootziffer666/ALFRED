"use client";

import Link from "next/link";
import { HOMELAB_STEPS, useHomelab, type HomelabStep } from "./useHomelab";
import { DevicesStep, ExportStep, HardwareStep, ModelsStep, NeedsStep, PlanStep, PoliciesStep } from "./steps";

/**
 * Raum IX · Werkstatt (plan §22.2). Planning only — nothing here prepares,
 * activates or checks anything, and the wording avoids pretending otherwise.
 */
export function HomelabClient() {
  const h = useHomelab();

  const body: Record<HomelabStep, React.ReactNode> = {
    devices: <DevicesStep h={h} />,
    hardware: <HardwareStep h={h} />,
    policies: <PoliciesStep h={h} />,
    needs: <NeedsStep h={h} />,
    models: <ModelsStep h={h} />,
    plan: <PlanStep h={h} />,
    export: <ExportStep h={h} />,
  };

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "28px 16px 72px", width: "100%" }}>
      <header style={{ marginBottom: 20 }}>
        <div
          className="mono"
          style={{ fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: "var(--bordeaux)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}
        >
          <span className="dot" style={{ background: "var(--zinnober)" }} />
          ALFRET · Raum IX · Werkstatt
          <Link className="pill" href="/">Repository-Butler</Link>
          <Link className="pill" href="/report">Öffentlicher Bericht</Link>
          <Link className="pill" href="/archive">Raum VIII</Link>
        </div>

        <h1 className="serif" style={{ fontSize: 28, margin: "12px 0 8px", color: "var(--paper)" }}>
          Vom Projektbedarf zur arbeitsfähigen Maschine.
        </h1>
        <p style={{ color: "var(--paper-dim)", margin: 0, lineHeight: 1.6, fontSize: 15 }}>
          Diese Etappe plant. Sie installiert nichts, startet nichts und prüft nichts — dafür fehlt
          der Runner. Was hier steht, ist eine Absicht mit ihrer Begründung.
        </p>
      </header>

      <nav aria-label="Raum IX Schritte" className="scroll-x" style={{ marginBottom: 20 }}>
        <ol style={{ display: "flex", gap: 6, listStyle: "none", padding: 0, margin: 0 }}>
          {HOMELAB_STEPS.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                className={h.step === s.id ? "" : "ghost"}
                aria-current={h.step === s.id ? "step" : undefined}
                onClick={() => h.setStep(s.id)}
              >
                {i + 1}. {s.label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      {h.notices.length > 0 ? (
        <ul role="status" style={{ listStyle: "none", padding: 0, margin: "0 0 16px", display: "grid", gap: 4 }}>
          {h.notices.map((n) => (
            <li key={n} className="mono" style={{ fontSize: 11.5, color: "var(--brass-l)", lineHeight: 1.5 }}>
              {n}
            </li>
          ))}
        </ul>
      ) : null}

      {body[h.step]}
    </main>
  );
}
