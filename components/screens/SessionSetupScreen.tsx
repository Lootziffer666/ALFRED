"use client";

import { useSession } from "../session/SessionContext";
import { CARD_CLASS, INPUT_CLASS, LABEL_CLASS, PRIMARY_BUTTON_CLASS, SECTION_KICKER_CLASS } from "./styles";

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
    <section className={CARD_CLASS}>
      <div className="flex items-center gap-2 mb-2">
        <span className={SECTION_KICKER_CLASS}>§ 1</span>
        <div className="h-px w-8 bg-primary/30" />
      </div>
      <h2 className="font-document-heading text-2xl text-on-surface mb-1">Session Setup</h2>
      <p className="font-body-md text-on-surface-variant text-sm italic mt-0 mb-6">
        Enter a repository and, optionally, credentials. Nothing is stored beyond this browser tab.
      </p>

      <label className="flex items-center gap-3 font-ui-label text-xs uppercase tracking-widest text-on-surface-variant mb-6 cursor-pointer">
        <input
          type="checkbox"
          checked={demoMode}
          onChange={(e) => setDemoMode(e.target.checked)}
          className="w-4 h-4 accent-primary-container cursor-pointer"
        />
        Demo mode (deterministic fixtures, no credentials or network needed)
      </label>

      <div className={`grid gap-5 ${demoMode ? "opacity-40 pointer-events-none" : ""}`}>
        <Field label="Repository (owner/repo or GitHub URL)">
          <input
            type="text"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="octo/widget-kit  or  https://github.com/octo/widget-kit"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="Branch / ref (optional — defaults to the repository's default branch)">
          <input
            type="text"
            value={refInput}
            onChange={(e) => setRefInput(e.target.value)}
            placeholder="main"
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="GitHub token (optional — higher rate limits, private repos)">
          <input
            type="password"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            placeholder="ghp_…"
            autoComplete="off"
            className={INPUT_CLASS}
          />
        </Field>

        <div className="grid gap-5 border-t border-dashed border-outline-variant/20 pt-5">
          <Field label="OpenRouter API key (required to build a contract map)">
            <input
              type="password"
              value={openRouterKey}
              onChange={(e) => setOpenRouterKey(e.target.value)}
              placeholder="sk-or-…"
              autoComplete="off"
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="OpenRouter model ID">
            <input
              type="text"
              value={openRouterModel}
              onChange={(e) => setOpenRouterModel(e.target.value)}
              placeholder="openrouter/auto, anthropic/claude-3.5-sonnet, …"
              className={INPUT_CLASS}
            />
          </Field>
        </div>
      </div>

      {inventoryError && !demoMode && (
        <p className="font-technical-data text-xs text-primary mt-4" role="alert">
          {inventoryError}
        </p>
      )}

      <div className="flex gap-3 mt-6 flex-wrap">
        {demoMode ? (
          <button type="button" onClick={() => setStep("inventory")} className={PRIMARY_BUTTON_CLASS}>
            Enter demo inventory →
          </button>
        ) : (
          <button
            type="button"
            disabled={inventoryLoading || !repoInput.trim()}
            onClick={runInspect}
            className={PRIMARY_BUTTON_CLASS}
          >
            {inventoryLoading ? "Connecting to GitHub…" : "Start inspection →"}
          </button>
        )}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={LABEL_CLASS}>{label}</span>
      {children}
    </label>
  );
}
