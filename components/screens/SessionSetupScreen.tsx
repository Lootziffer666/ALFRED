"use client";

import { useSession } from "../session/SessionContext";

export function SessionSetupScreen() {
  const {
    demoMode,
    setDemoMode,
    repoInput,
    setRepoInput,
    refInput,
    setRefInput,
    githubToken,
    setGithubToken,
    openRouterKey,
    setOpenRouterKey,
    openRouterModel,
    setOpenRouterModel,
    inventoryLoading,
    inventoryError,
    runInspect,
    setStep,
  } = useSession();

  return (
    <section className="card" style={{ padding: 20 }}>
      <h2 style={{ fontSize: 20, margin: "0 0 4px" }}>§ 1 · Session setup</h2>
      <p className="serif" style={{ color: "var(--paper-dim)", marginTop: 0, fontSize: 14 }}>
        Enter a repository and, optionally, credentials. Nothing is stored beyond this browser tab.
      </p>

      <label className="mono" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, margin: "14px 0" }}>
        <input
          type="checkbox"
          checked={demoMode}
          onChange={(e) => setDemoMode(e.target.checked)}
          style={{ width: 18, height: 18 }}
        />
        Demo mode (deterministic fixtures, no credentials or network needed)
      </label>

      <div style={{ display: "grid", gap: 12, opacity: demoMode ? 0.5 : 1, pointerEvents: demoMode ? "none" : "auto" }}>
        <Field label="Repository (owner/repo or GitHub URL)">
          <input
            type="text"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="octo/widget-kit  or  https://github.com/octo/widget-kit"
          />
        </Field>
        <Field label="Branch / ref (optional — defaults to the repository's default branch)">
          <input type="text" value={refInput} onChange={(e) => setRefInput(e.target.value)} placeholder="main" />
        </Field>
        <Field label="GitHub token (optional — higher rate limits, private repos)">
          <input
            type="password"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            placeholder="ghp_…"
            autoComplete="off"
          />
        </Field>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr", borderTop: "1px dashed var(--line)", paddingTop: 12 }}>
          <Field label="OpenRouter API key (required to build a contract map)">
            <input
              type="password"
              value={openRouterKey}
              onChange={(e) => setOpenRouterKey(e.target.value)}
              placeholder="sk-or-…"
              autoComplete="off"
            />
          </Field>
          <Field label="OpenRouter model ID">
            <input
              type="text"
              value={openRouterModel}
              onChange={(e) => setOpenRouterModel(e.target.value)}
              placeholder="openrouter/auto, anthropic/claude-3.5-sonnet, …"
            />
          </Field>
        </div>
      </div>

      {inventoryError && !demoMode && (
        <p className="mono" style={{ color: "var(--zinnober)", fontSize: 12, marginTop: 12 }} role="alert">
          {inventoryError}
        </p>
      )}

      <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
        {demoMode ? (
          <button className="primary" type="button" onClick={() => setStep("inventory")}>
            Enter demo inventory →
          </button>
        ) : (
          <button className="primary" type="button" disabled={inventoryLoading || !repoInput.trim()} onClick={runInspect}>
            {inventoryLoading ? "Connecting to GitHub…" : "Start inspection →"}
          </button>
        )}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <span className="mono" style={{ display: "block", fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--mut)", marginBottom: 5 }}>
        {label}
      </span>
      {children}
    </label>
  );
}
