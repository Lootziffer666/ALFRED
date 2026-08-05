// plan §18 — Tests für Config, Credentials, Scope.
// Keine Fake-Timers; now wird injiziert wo nötig.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig, resolveRepoConfig, daemonConfigSchema } from "../lib/daemon/config";
import { loadCredentials, redact, scrubSecrets } from "../lib/daemon/credentials";
import { loadScopeRegistry, EMPTY_SCOPE_REGISTRY } from "../lib/daemon/scope";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

describe("daemonConfig", () => {
  it("{} parses to full defaults", () => {
    const result = daemonConfigSchema.safeParse({});

    expect(result.success).toBe(true);

    if (!result.success) return;

    expect(result.data.dryRun).toBe(true);
    expect(result.data.armed).toBe(false);
    expect(result.data.skills.allowLlmGeneration).toBe(false);
    expect(result.data.repositories).toEqual({});
  });

  it("armed default is false", () => {
    const r = daemonConfigSchema.parse({});
    expect(r.armed).toBe(false);
  });

  it("dryRun default is true", () => {
    const r = daemonConfigSchema.parse({});
    expect(r.dryRun).toBe(true);
  });

  it("allowLlmGeneration default is false — security invariant", () => {
    const r = daemonConfigSchema.parse({});
    expect(r.skills.allowLlmGeneration).toBe(false);
  });

  it("invalid regexp in docRelevantGlobs throws", () => {
    const r = daemonConfigSchema.safeParse({ docRelevantGlobs: ["[invalid"] });
    expect(r.success).toBe(false);
  });

  it("missing config file returns defaults + warning", async () => {
    const result = await loadConfig({ file: "/nonexistent/alfret/config.json" });

    expect(result.source).toBe("defaults");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.config.dryRun).toBe(true);
  });

  it("broken config file throws", async () => {
    const dir = await mkdtemp(join(tmpdir(), "alfret-test-"));

    const file = join(dir, "config.json");

    await writeFile(file, '{"tickIntervalMs": "not-a-number"}');

    await expect(loadConfig({ file })).rejects.toThrow();

    await rm(dir, { recursive: true });
  });
});

describe("resolveRepoConfig", () => {
  it("returns per-repo armed, falls back to global tickIntervalMs", () => {
    const config = daemonConfigSchema.parse({
      tickIntervalMs: 900_000,

      repositories: {
        "owner/repo": { armed: true },
      },
    });

    const r = resolveRepoConfig(config, "owner/repo");

    expect(r.armed).toBe(true);
    expect(r.tickIntervalMs).toBe(900_000);
    expect(r.repository).toBe("owner/repo");
  });

  it("unknown repo gets safe defaults", () => {
    const config = daemonConfigSchema.parse({});

    const r = resolveRepoConfig(config, "owner/unknown");

    expect(r.armed).toBe(false);
    expect(r.dryRun).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

describe("daemonCredentials", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "alfret-creds-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true });
    delete process.env.ALFRET_GITHUB_TOKEN;
  });

  it("env var takes precedence over file", async () => {
    process.env.ALFRET_GITHUB_TOKEN = "ghp_envtoken";

    const result = await loadCredentials(join(dir, "credentials.json"));

    expect(result.source).toBe("env");
    expect(result.token).toBe("ghp_envtoken");
  });

  it("credentials roundtrip: store + load", async () => {
    const file = join(dir, "credentials.json");

    const { writeJson } = await import("../lib/daemon/paths");

    await writeJson(file, {
      githubToken: "ghp_testtoken1234",
      storedAt: new Date().toISOString(),
      fingerprint: redact("ghp_testtoken1234"),
    });

    const result = await loadCredentials(file);

    expect(result.token).toBe("ghp_testtoken1234");
    expect(result.fingerprint).toBe("••••1234");
  });

  it("credentials.json with wrong mode throws", async () => {
    const file = join(dir, "credentials.json");

    await writeFile(file, JSON.stringify({ githubToken: "ghp_x", storedAt: "", fingerprint: "" }));

    await chmod(file, 0o644);

    await expect(loadCredentials(file)).rejects.toThrow(/0600/);
  });

  it("missing credentials file throws with guidance", async () => {
    await expect(loadCredentials(join(dir, "none.json"))).rejects.toThrow(
      /ALFRET_GITHUB_TOKEN/,
    );
  });

  it("redact never exposes more than 4 chars", () => {
    expect(redact("ghp_averylongtoken123456")).toBe("••••3456");
    expect(redact("ab")).toBe("••••");
  });

  it("scrubSecrets replaces token in log message", () => {
    const token = "ghp_supersecret9999";

    const msg = `Fetching with token ${token} from github`;

    const scrubbed = scrubSecrets(msg, [token]);

    expect(scrubbed).not.toContain(token);
    expect(scrubbed).toContain("••••9999");
  });
});

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

describe("daemonScope", () => {
  it("missing scope.json returns EMPTY_SCOPE_REGISTRY + warning", async () => {
    const result = await loadScopeRegistry("/nonexistent/scope.json");

    expect(result.source).toBe("empty");
    expect(result.registry).toEqual(EMPTY_SCOPE_REGISTRY);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("EMPTY_SCOPE_REGISTRY has no repositories — fail-closed", () => {
    expect(Object.keys(EMPTY_SCOPE_REGISTRY.repositories)).toHaveLength(0);
  });

  it("malformed scope.json throws", async () => {
    const dir = await mkdtemp(join(tmpdir(), "alfret-scope-"));

    const file = join(dir, "scope.json");

    await writeFile(file, '{"repositories": "not-an-object"}');

    await expect(loadScopeRegistry(file)).rejects.toThrow();

    await rm(dir, { recursive: true });
  });
});
