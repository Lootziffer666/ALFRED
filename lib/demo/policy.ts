/**
 * Demo-Policy (Etappe 12b).
 *
 * Erzwingt die harten Limits der Public Demo aus §7.1 und §11:
 * - Nur öffentliche Repositories
 * - Keine Secrets
 * - Harte Zeitlimits
 * - Harte CPU/RAM/PID/Storage-Limits (als Konfiguration, enforcement
 *   liegt beim Sandbox-Provider — hier wird nur deklariert und geprüft)
 * - Keine Verbindung zum lokalen Homelab
 *
 * Diese Datei enthält:
 * 1. Die kanonische Demo-Policy-Konfiguration
 * 2. Einen Policy-Validator der Requests gegen die Policy prüft
 * 3. Einen Policy-Enforcer der Route-Handler wrappen kann
 *
 * Der Enforcer ist kein Middleware-Ersatz. Er ergänzt die Edge-Middleware
 * um tiefere, typsichere Checks die die Middleware nicht kennt.
 */

import type { OperatingProfile } from "@/lib/schema/homelab";

// ── Demo-Limits ───────────────────────────────────────────────────────────────

export interface DemoResourceLimits {
  /** Maximale Ausführungszeit in Millisekunden. */
  maxExecutionMs: number;

  /** Maximaler Speicher in Bytes (deklarativ — Sandbox-Provider erzwingt). */
  maxMemoryBytes: number;

  /** Maximale CPU-Sekunden (deklarativ). */
  maxCpuSeconds: number;

  /** Maximale Prozesse / PIDs (deklarativ). */
  maxPids: number;

  /** Maximaler Storage-Verbrauch in Bytes (deklarativ). */
  maxStorageBytes: number;

  /** Maximale Output-Größe in Bytes. */
  maxOutputBytes: number;
}

export const DEMO_RESOURCE_LIMITS: DemoResourceLimits = {
  maxExecutionMs:  30_000,        // 30 Sekunden
  maxMemoryBytes:  256 * 1024 * 1024, // 256 MB
  maxCpuSeconds:   10,
  maxPids:         32,
  maxStorageBytes: 64 * 1024 * 1024,  // 64 MB
  maxOutputBytes:  512 * 1024,         // 512 KB
};

// ── Policy-Violations ─────────────────────────────────────────────────────────

export type DemoPolicyViolationKind =
  | "private-repository"         // Repository ist nicht öffentlich
  | "secret-detected"            // Secret im Request-Body oder Parametern erkannt
  | "local-runner-reference"     // Referenz auf lokalen Runner oder privates Node
  | "disallowed-executor"        // Executor-Typ nicht erlaubt in Public Demo
  | "operation-not-permitted"    // Operation generell nicht erlaubt in Public Demo
  | "payload-too-large"          // Body überschreitet maxOutputBytes
  | "timeout-exceeded";          // Ausführung überschreitet maxExecutionMs

export interface DemoPolicyViolation {
  kind: DemoPolicyViolationKind;
  message: string;
  field?: string;
}

// ── Request-Policy-Check ──────────────────────────────────────────────────────

export interface DemoPolicyCheckInput {
  /** Repository-URL aus dem Request. */
  repoUrl?: string;

  /** Node-ID aus dem Request — darf in Public Demo nicht privat/lokal sein. */
  nodeId?: string;

  /** Executor-Typ. */
  executor?: string;

  /** Rohes Request-Body als String (für Secret-Scan). */
  rawBody?: string;

  /** Größe des Request-Body in Bytes. */
  bodySizeBytes?: number;
}

const ALLOWED_DEMO_EXECUTORS = new Set([
  "deterministic-demo",
  "web-sandbox",
  "codespace-demo",
  "external-demo-worker",
]);

const PRIVATE_NODE_PATTERNS = [
  /^local-/i,
  /^homelab-/i,
  /^private-/i,
  /^lan-/i,
  /^tailscale-/i,   // in Public Demo verboten — lokale Tailscale-Nodes
];

/**
 * Grobe Secret-Erkennung für Request-Bodies.
 * Kein Ersatz für den vollen Secret-Scanner (lib/security/secrets.ts),
 * aber schnell genug für einen Policy-Check im Request-Pfad.
 */
const SECRET_PATTERNS = [
  { name: "GitHub-Token",      pattern: /ghp_[A-Za-z0-9]{36}/ },
  { name: "GitHub-Token fine", pattern: /github_pat_[A-Za-z0-9_]{82}/ },
  { name: "OpenRouter-Key",    pattern: /sk-or-v1-[A-Za-z0-9]{64}/ },
  { name: "OpenAI-Key",        pattern: /sk-[A-Za-z0-9]{48}/ },
  { name: "HuggingFace-Token", pattern: /hf_[A-Za-z0-9]{37}/ },
  { name: "Generic-Bearer",    pattern: /bearer\s+[A-Za-z0-9\-._~+\/]{32,}/i },
];

export function checkDemoPolicy(
  input: DemoPolicyCheckInput,
  profile: OperatingProfile,
): DemoPolicyViolation[] {
  // In der lokalen Installation gelten keine Demo-Limits.
  if (profile === "local-installation") return [];

  const violations: DemoPolicyViolation[] = [];

  // ── Repository-URL: muss GitHub-öffentlich sein ─────────────────────────
  if (input.repoUrl) {
    const url = input.repoUrl.trim();
    // Wir können ohne Netzwerkzugriff nicht verifizieren ob ein Repo öffentlich
    // ist — aber wir können offensichtlich private Patterns erkennen.
    if (
      url.includes("github.com/") === false ||
      /git@/.test(url) // SSH-URLs implizieren oft private Repos
    ) {
      violations.push({
        kind: "private-repository",
        message: "Die Public Demo akzeptiert nur öffentliche GitHub-HTTPS-URLs.",
        field: "repoUrl",
      });
    }
  }

  // ── Node-ID: kein lokaler Runner ─────────────────────────────────────────
  if (input.nodeId) {
    const isPrivate = PRIVATE_NODE_PATTERNS.some((p) => p.test(input.nodeId!));
    if (isPrivate) {
      violations.push({
        kind: "local-runner-reference",
        message: `Node "${input.nodeId}" ist in der Public Demo nicht erlaubt.`,
        field: "nodeId",
      });
    }
  }

  // ── Executor ─────────────────────────────────────────────────────────────
  if (input.executor && !ALLOWED_DEMO_EXECUTORS.has(input.executor)) {
    violations.push({
      kind: "disallowed-executor",
      message: `Executor "${input.executor}" ist in der Public Demo nicht erlaubt.`,
      field: "executor",
    });
  }

  // ── Secret-Scan ──────────────────────────────────────────────────────────
  if (input.rawBody) {
    for (const { name, pattern } of SECRET_PATTERNS) {
      if (pattern.test(input.rawBody)) {
        violations.push({
          kind: "secret-detected",
          message: `Mögliches Secret (${name}) im Request-Body erkannt. Keine Secrets in Demo-Requests.`,
          field: "body",
        });
        break; // Ein Fund reicht — nicht alle einzeln aufzählen
      }
    }
  }

  // ── Payload-Größe ─────────────────────────────────────────────────────────
  if (
    input.bodySizeBytes !== undefined &&
    input.bodySizeBytes > DEMO_RESOURCE_LIMITS.maxOutputBytes
  ) {
    violations.push({
      kind: "payload-too-large",
      message: `Request-Body überschreitet das Demo-Limit von ${DEMO_RESOURCE_LIMITS.maxOutputBytes} Bytes.`,
      field: "body",
    });
  }

  return violations;
}

// ── Timeout-Wrapper ───────────────────────────────────────────────────────────

/**
 * Führt eine async Funktion mit einem harten Timeout aus.
 * Wenn das Timeout überschritten wird, wird ein Fehler geworfen.
 *
 * Wird von Route-Handlern verwendet um die Demo-Ausführungszeit zu begrenzen.
 */
export async function withDemoTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs = DEMO_RESOURCE_LIMITS.maxExecutionMs,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new DemoPolicyError(
          "timeout-exceeded",
          `Demo-Ausführung überschritt das Zeitlimit von ${timeoutMs}ms.`,
        ),
      );
    }, timeoutMs);

    fn().then(
      (result) => { clearTimeout(timer); resolve(result); },
      (err)    => { clearTimeout(timer); reject(err); },
    );
  });
}

// ── Policy-Error ──────────────────────────────────────────────────────────────

export class DemoPolicyError extends Error {
  constructor(
    public readonly kind: DemoPolicyViolationKind,
    message: string,
  ) {
    super(message);
    this.name = "DemoPolicyError";
  }
}
