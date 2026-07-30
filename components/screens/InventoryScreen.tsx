"use client";

import { useSession } from "../session/SessionContext";
import { AvailabilityBadge, reasonOf } from "../AvailabilityBadge";

export function InventoryScreen() {
  const { inventory, contractLoading, contractError, runContractMap, openRouterKey, openRouterModel, demoMode, setStep } = useSession();

  if (!inventory) {
    return (
      <section className="card" style={{ padding: 20 }}>
        <p className="serif">No repository has been inspected yet. Go back to session setup.</p>
      </section>
    );
  }

  const { identity } = inventory;

  return (
    <section className="card" style={{ padding: 20 }}>
      <h2 style={{ fontSize: 20, margin: "0 0 4px" }}>§ 2 · Repository inventory</h2>
      <p className="serif" style={{ color: "var(--paper-dim)", marginTop: 0, fontSize: 14 }}>
        What is verifiably present in {identity.owner}/{identity.name}@{identity.ref}.
      </p>

      <div className="card-inset" style={{ padding: 14, marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div className="mono" style={{ fontSize: 11, color: "var(--mut)" }}>REPOSITORY</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              <a href={identity.url} target="_blank" rel="noreferrer">
                {identity.owner}/{identity.name}
              </a>
            </div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 11, color: "var(--mut)" }}>REF</div>
            <div className="mono" style={{ fontSize: 13 }}>{identity.ref}</div>
          </div>
        </div>
        {identity.description && <p className="serif" style={{ marginTop: 10, marginBottom: 0 }}>{identity.description}</p>}
      </div>

      <EvidenceRow label="File tree" availability={inventory.tree}>
        {(data) => `${data.length} entries collected.`}
      </EvidenceRow>

      <EvidenceRow label="Documentation (README / PLAN / AGENTS / docs/*.md)" availability={inventory.docs}>
        {(data) =>
          data.length === 0 ? "No matching documentation files found." : data.map((d) => `${d.path} (${d.truncated ? `truncated, ${d.fullLength} chars` : "full"})`).join(", ")
        }
      </EvidenceRow>

      <EvidenceRow label="Package manifest" availability={inventory.packageManifest}>
        {(data) =>
          data
            ? `Stack: ${data.detectedStack.join(", ") || "none detected"} · Package manager: ${data.packageManager ?? "unknown"} · Scripts: ${Object.keys(data.scripts).join(", ") || "none"}`
            : "No package.json in this repository."
        }
      </EvidenceRow>

      <EvidenceRow label="Recent commits" availability={inventory.commits}>
        {(data) => `${data.length} commit(s) collected.`}
      </EvidenceRow>

      <EvidenceRow label="Open pull requests" availability={inventory.pullRequests}>
        {(data) => `${data.openCount} open. ${data.recent.map((p) => `#${p.number} ${p.title}`).join("; ")}`}
      </EvidenceRow>

      <EvidenceRow label="Open issues" availability={inventory.issues}>
        {(data) => `${data.openCount} open.`}
      </EvidenceRow>

      {inventory.warnings.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--mut)", marginBottom: 6 }}>WARNINGS</div>
          {inventory.warnings.map((w, i) => (
            <p key={i} className="serif" style={{ fontStyle: "italic", color: "var(--paper-dim)", fontSize: 13, margin: "4px 0" }}>
              ⚠ {w}
            </p>
          ))}
        </div>
      )}

      <div className="card-inset" style={{ padding: 14, marginTop: 16 }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--mut)", marginBottom: 8 }}>
          BUILD CONTRACT MAP — sends the evidence above to the selected OpenRouter model
        </div>
        {!demoMode && (!openRouterKey || !openRouterModel) && (
          <p className="serif" style={{ fontSize: 13, color: "var(--paper-dim)" }}>
            Add an OpenRouter API key and model on the setup screen first.
          </p>
        )}
        {contractError && (
          <p className="mono" style={{ color: "var(--zinnober)", fontSize: 12 }} role="alert">
            {contractError}
          </p>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {demoMode ? (
            <button className="primary" type="button" onClick={() => setStep("contract")}>
              View demo contract map →
            </button>
          ) : (
            <button
              className="primary"
              type="button"
              disabled={contractLoading || !openRouterKey || !openRouterModel}
              onClick={runContractMap}
            >
              {contractLoading ? "Analyzing with model…" : "Build contract map →"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function EvidenceRow<T>({
  label,
  availability,
  children,
}: {
  label: string;
  availability: { status: string; data?: T; reason?: string };
  children: (data: T) => string;
}) {
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--line)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="mono" style={{ fontSize: 12, color: "var(--paper-dim)" }}>{label}</span>
        <AvailabilityBadge status={availability.status as never} />
      </div>
      {availability.status === "loaded" ? (
        <p className="serif" style={{ fontSize: 13.5, margin: "6px 0 0" }}>{children(availability.data as T)}</p>
      ) : availability.status !== "loading" ? (
        <p className="mono" style={{ fontSize: 12, color: "var(--mut)", margin: "6px 0 0" }}>{reasonOf(availability as never)}</p>
      ) : null}
    </div>
  );
}
