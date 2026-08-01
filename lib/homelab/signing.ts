import type { SignedExecutionPlan } from "../schema/homelab";

/**
 * Plan signing (plan §17.2). ALFRET signs, the runner verifies, and both use
 * this file so the two can never disagree about what was signed.
 *
 * ECDSA P-256 over SHA-256, via WebCrypto — present in the browser and in the
 * runner's runtime alike, so there is one implementation rather than two that
 * must be kept in step.
 */

const ALGORITHM = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIGN_PARAMS = { name: "ECDSA", hash: "SHA-256" } as const;

/** The fields that are signed. `signature` itself is necessarily excluded. */
export type SignablePlan = Omit<SignedExecutionPlan, "signature">;

/**
 * Deterministic serialisation: object keys sorted at every depth, no
 * whitespace. Two structurally equal plans must produce byte-identical input,
 * or a signature would depend on key order rather than on content.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
}

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error("WebCrypto ist in dieser Umgebung nicht verfügbar.");
  return c.subtle;
}

const encoder = new TextEncoder();

function toBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface ExportedKeyPair {
  /** SPKI, base64 — what the runner stores at pairing time. */
  publicKey: string;
  /** PKCS#8, base64 — never leaves the instance that owns it. */
  privateKey: string;
  keyId: string;
}

export async function generateKeyPair(): Promise<ExportedKeyPair> {
  const pair = await subtle().generateKey(ALGORITHM, true, ["sign", "verify"]);
  const publicKey = toBase64(await subtle().exportKey("spki", pair.publicKey));
  const privateKey = toBase64(await subtle().exportKey("pkcs8", pair.privateKey));
  return { publicKey, privateKey, keyId: await fingerprint(publicKey) };
}

/**
 * A short, readable fingerprint of a public key. This is what a person
 * compares between the runner's screen and ALFRET's before confirming — so it
 * is grouped rather than presented as one unbroken string.
 */
export async function fingerprint(publicKeyBase64: string): Promise<string> {
  const digest = await subtle().digest("SHA-256", fromBase64(publicKeyBase64) as BufferSource);
  const hex = [...new Uint8Array(digest)]
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return (hex.match(/.{4}/g) ?? []).join("-").toUpperCase();
}

async function importPrivate(privateKeyBase64: string): Promise<CryptoKey> {
  return subtle().importKey("pkcs8", fromBase64(privateKeyBase64) as BufferSource, ALGORITHM, false, ["sign"]);
}

async function importPublic(publicKeyBase64: string): Promise<CryptoKey> {
  return subtle().importKey("spki", fromBase64(publicKeyBase64) as BufferSource, ALGORITHM, false, ["verify"]);
}

export async function signPlan(plan: SignablePlan, privateKeyBase64: string): Promise<SignedExecutionPlan> {
  const key = await importPrivate(privateKeyBase64);
  const payload = encoder.encode(canonicalize(plan));
  const signature = await subtle().sign(SIGN_PARAMS, key, payload as BufferSource);
  return { ...plan, signature: toBase64(signature) };
}

export async function verifySignature(plan: SignedExecutionPlan, publicKeyBase64: string): Promise<boolean> {
  const { signature, ...signable } = plan;
  if (!signature) return false;
  try {
    const key = await importPublic(publicKeyBase64);
    const payload = encoder.encode(canonicalize(signable));
    return await subtle().verify(SIGN_PARAMS, key, fromBase64(signature) as BufferSource, payload as BufferSource);
  } catch {
    return false;
  }
}

/** A one-time code the user carries from the runner to ALFRET. */
export function generatePairingCode(): string {
  const bytes = new Uint8Array(5);
  globalThis.crypto.getRandomValues(bytes);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const code = [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
  return `${code.slice(0, 5)}`;
}
