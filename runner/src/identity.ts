import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fingerprint, generateKeyPair, generatePairingCode } from "../../lib/homelab/signing";

/**
 * Node identity and pairing (plan §17.2).
 *
 * The runner makes its own key pair and keeps the private half. Pairing stores
 * the public key of exactly one ALFRET instance — the only signer this machine
 * will ever accept. Nothing long-lived is handed out: the pairing code is
 * one-time, and what a person compares is a fingerprint, not a secret.
 */

export interface RunnerIdentity {
  nodeId: string;
  publicKey: string;
  privateKey: string;
  createdAt: string;
}

export interface PairingState {
  /** Public key of the authorised ALFRET instance, once pairing completed. */
  authorizedPublicKey: string | null;
  authorizedFingerprint: string | null;
  pairedAt: string | null;
  /** Active one-time code, shown on the runner's own console. */
  pendingCode: string | null;
  pendingUntil: string | null;
}

export const PAIRING_CODE_TTL_SECONDS = 600;

const IDENTITY_FILE = "identity.json";
const PAIRING_FILE = "pairing.json";

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

/** Private key material is written owner-readable only. */
async function writeJson(file: string, value: unknown, mode = 0o600): Promise<void> {
  await writeFile(file, JSON.stringify(value, null, 2), { mode });
}

export async function loadOrCreateIdentity(root: string): Promise<RunnerIdentity> {
  await mkdir(root, { recursive: true, mode: 0o700 });
  const file = path.join(root, IDENTITY_FILE);

  const existing = await readJson<RunnerIdentity>(file);
  if (existing?.nodeId && existing.privateKey) return existing;

  const keys = await generateKeyPair();
  const identity: RunnerIdentity = {
    nodeId: `${os.hostname().toLowerCase().replace(/[^a-z0-9-]/g, "-")}-${keys.keyId.slice(0, 4).toLowerCase()}`,
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
    createdAt: new Date().toISOString(),
  };
  await writeJson(file, identity);
  return identity;
}

export const UNPAIRED: PairingState = {
  authorizedPublicKey: null,
  authorizedFingerprint: null,
  pairedAt: null,
  pendingCode: null,
  pendingUntil: null,
};

export async function loadPairing(root: string): Promise<PairingState> {
  return (await readJson<PairingState>(path.join(root, PAIRING_FILE))) ?? { ...UNPAIRED };
}

export async function savePairing(root: string, state: PairingState): Promise<void> {
  await writeJson(path.join(root, PAIRING_FILE), state);
}

/** Starts a pairing window and returns the code to read out to the user. */
export function beginPairing(now = new Date()): { code: string; until: string } {
  return {
    code: generatePairingCode(),
    until: new Date(now.getTime() + PAIRING_CODE_TTL_SECONDS * 1000).toISOString(),
  };
}

export type PairingResult =
  | { ok: true; state: PairingState; fingerprint: string }
  | { ok: false; reason: string };

/**
 * Completes pairing. Requires the current one-time code, and refuses to pair a
 * second instance — a runner answers to one ALFRET, and re-pairing is a
 * deliberate act on the machine itself.
 */
export async function completePairing(
  state: PairingState,
  input: { code: string; publicKey: string },
  now = new Date(),
): Promise<PairingResult> {
  if (state.authorizedPublicKey) {
    return { ok: false, reason: "Dieser Runner ist bereits gepairt. Zum Neupairen lokal zurücksetzen." };
  }
  if (!state.pendingCode || !state.pendingUntil) {
    return { ok: false, reason: "Kein Pairing-Fenster offen. Auf dem Node „alfret-runner pair“ ausführen." };
  }
  if (Date.parse(state.pendingUntil) <= now.getTime()) {
    return { ok: false, reason: "Der Pairing-Code ist abgelaufen." };
  }
  if (input.code.trim().toUpperCase() !== state.pendingCode) {
    return { ok: false, reason: "Pairing-Code stimmt nicht." };
  }

  const print = await fingerprint(input.publicKey);
  return {
    ok: true,
    fingerprint: print,
    state: {
      authorizedPublicKey: input.publicKey,
      authorizedFingerprint: print,
      pairedAt: now.toISOString(),
      pendingCode: null,
      pendingUntil: null,
    },
  };
}
