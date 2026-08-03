// plan §18 — Token storage and retrieval.
// Security rules encoded here:
//   1. File mode 0o600 is enforced at startup — startup is refused otherwise (ssh-style).
//   2. ALFRET_GITHUB_TOKEN env var wins over disk (enables systemd-LoadCredential / Secrets Manager).
//   3. redact() never exposes more than the last 4 characters.
//   4. secretsOf() feeds the log scrubber — every secret string the process knows about.

import { readJson, writeJson, credentialsPath, ensureAlfretDirs } from "./paths";
import { stat } from "node:fs/promises";

export interface StoredCredentials {
  githubToken: string;
  /** ISO timestamp of when the token was stored. */
  storedAt: string;
  /** Optional: last 4 chars for log display, pre-computed to avoid accidental full exposure. */
  fingerprint: string;
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

/** Returns "••••XXXX" where XXXX is the last 4 chars of the token. */
export function redact(token: string): string {
  if (token.length <= 4) return "••••";
  return `••••${token.slice(-4)}`;
}

/** All secret strings the process holds — fed to the log scrubber. */
export function secretsOf(creds: StoredCredentials): string[] {
  return [creds.githubToken];
}

// ---------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------

export interface LoadCredentialsResult {
  token: string;
  source: "env" | "file";
  fingerprint: string;
}

/**
 * Load the GitHub token. Precedence: env var > credentials.json.
 * Refuses to start if credentials.json exists with mode > 0o600.
 */
export async function loadCredentials(
  file = credentialsPath(),
): Promise<LoadCredentialsResult> {
  const envToken = process.env.ALFRET_GITHUB_TOKEN;

  if (envToken) {
    return { token: envToken, source: "env", fingerprint: redact(envToken) };
  }

  let mode: number;

  try {
    mode = (await stat(file)).mode & 0o777;
  } catch {
    throw new Error(
      `No GitHub token found. Set ALFRET_GITHUB_TOKEN or run: alfret-daemon login`,
    );
  }

  if (mode !== 0o600) {
    throw new Error(
      `credentials.json has permissions ${mode.toString(8)}, expected 0600. ` +
        `Run: chmod 600 ${file}`,
    );
  }

  const stored = await readJson<StoredCredentials>(file);

  if (!stored?.githubToken) {
    throw new Error(
      `credentials.json is missing githubToken. Run: alfret-daemon login`,
    );
  }

  return {
    token: stored.githubToken,
    source: "file",
    fingerprint: stored.fingerprint ?? redact(stored.githubToken),
  };
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/** Persist a token to credentials.json at 0o600. */
export async function storeCredentials(token: string): Promise<void> {
  await ensureAlfretDirs();

  const creds: StoredCredentials = {
    githubToken: token,
    storedAt: new Date().toISOString(),
    fingerprint: redact(token),
  };

  await writeJson(credentialsPath(), creds, 0o600);
}

// ---------------------------------------------------------------------------
// Log scrubber
// ---------------------------------------------------------------------------

/**
 * Replace all known secrets in a log message with their redacted forms.
 * Call this at the log sink, never on individual fields.
 */
export function scrubSecrets(message: string, secrets: string[]): string {
  let out = message;

  for (const secret of secrets) {
    if (secret.length < 4) continue;

    out = out.replaceAll(secret, redact(secret));
  }

  return out;
}
