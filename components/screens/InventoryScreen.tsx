"use client";

import { useSession } from "../session/SessionContext";
import { AvailabilityBadge, reasonOf } from "../AvailabilityBadge";
import { CARD_CLASS, CARD_INSET_CLASS, PRIMARY_BUTTON_CLASS, SECTION_KICKER_CLASS } from "./styles";

export function InventoryScreen() {
  const { inventory, contractLoading, contractError, runContractMap, openRouterKey, openRouterModel, demoMode, setStep } = useSession();

  if (!inventory) {
    return (
      <section className={CARD_CLASS}>
        <p className="font-body-md text-on-surface-variant italic">No repository has been inspected yet. Go back to session setup.</p>
      </section>
    );
  }

  const { identity } = inventory;

  return (
    <section className={CARD_CLASS}>
      <div className="flex items-center gap-2 mb-2">
        <span className={SECTION_KICKER_CLASS}>§ 2</span>
        <div className="h-px w-8 bg-primary/30" />
      </div>
      <h2 className="font-document-heading text-2xl text-on-surface mb-1">Repository Inventory</h2>
      <p className="font-body-md text-on-surface-variant text-sm italic mt-0 mb-6">
        What is verifiably present in {identity.owner}/{identity.name}@{identity.ref}.
      </p>

      <div className={`${CARD_INSET_CLASS} mb-2`}>
        <div className="flex justify-between flex-wrap gap-3">
          <div>
            <div className="font-technical-data text-[11px] text-on-surface-variant/50 uppercase tracking-widest">Repository</div>
            <div className="text-[15px] font-semibold text-on-surface mt-0.5">
              <a href={identity.url} target="_blank" rel="noreferrer" className="text-primary hover:brightness-110">
                {identity.owner}/{identity.name}
              </a>
            </div>
          </div>
          <div>
            <div className="font-technical-data text-[11px] text-on-surface-variant/50 uppercase tracking-widest">Ref</div>
            <div className="font-technical-data text-[13px] text-on-surface mt-0.5">{identity.ref}</div>
          </div>
        </div>
        {identity.description && (
          <p className="font-body-md text-on-surface-variant text-sm mt-3 mb-0">{identity.description}</p>
        )}
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
        <div className="mt-4">
          <div className="font-technical-data text-[11px] text-on-surface-variant/50 uppercase tracking-widest mb-1.5">Warnings</div>
          {inventory.warnings.map((w, i) => (
            <p key={i} className="font-body-md italic text-on-surface-variant text-[13px] my-1">
              ⚠ {w}
            </p>
          ))}
        </div>
      )}

      <div className={`${CARD_INSET_CLASS} mt-5`}>
        <div className="font-technical-data text-[11px] text-on-surface-variant/50 uppercase tracking-widest mb-2">
          Build Contract Map — sends the evidence above to the selected OpenRouter model
        </div>
        {!demoMode && (!openRouterKey || !openRouterModel) && (
          <p className="font-body-md text-on-surface-variant text-[13px]">
            Add an OpenRouter API key and model on the setup screen first.
          </p>
        )}
        {contractError && (
          <p className="font-technical-data text-xs text-primary" role="alert">
            {contractError}
          </p>
        )}
        <div className="flex gap-3 flex-wrap mt-1">
          {demoMode ? (
            <button type="button" onClick={() => setStep("contract")} className={PRIMARY_BUTTON_CLASS}>
              View demo contract map →
            </button>
          ) : (
            <button
              type="button"
              disabled={contractLoading || !openRouterKey || !openRouterModel}
              onClick={runContractMap}
              className={PRIMARY_BUTTON_CLASS}
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
    <div className="mt-4 pt-4 border-t border-dashed border-outline-variant/15">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <span className="font-technical-data text-xs text-on-surface-variant">{label}</span>
        <AvailabilityBadge status={availability.status as never} />
      </div>
      {availability.status === "loaded" ? (
        <p className="font-body-md text-[13.5px] text-on-surface mt-1.5 mb-0">{children(availability.data as T)}</p>
      ) : availability.status !== "loading" ? (
        <p className="font-technical-data text-xs text-on-surface-variant/50 mt-1.5 mb-0">{reasonOf(availability as never)}</p>
      ) : null}
    </div>
  );
}
