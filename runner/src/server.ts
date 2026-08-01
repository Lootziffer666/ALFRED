import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fingerprint } from "../../lib/homelab/signing";
import { admitPlan, MemoryNonceStore, type GuardContext, type LocalNodePolicy } from "./guard";
import { executePlan } from "./executor";
import { probeNode, takeSnapshot, RUNNER_VERSION } from "./probe";
import {
  beginPairing,
  completePairing,
  loadPairing,
  savePairing,
  type PairingState,
  type RunnerIdentity,
} from "./identity";
import type { AdapterRegistry } from "./adapters";

/**
 * The runner's local API (plan §17.5).
 *
 * Transport note: this server speaks plain HTTP and is therefore bound to the
 * loopback interface unless told otherwise. Reaching it from another machine
 * is Tailscale's job, or local HTTPS — not a wider bind. CORS is not
 * authentication and is not used as such: every plan carries its own
 * signature, and reading endpoints expose nothing secret.
 */

export interface ServerOptions {
  identity: RunnerIdentity;
  root: string;
  adapters: AdapterRegistry;
  policy: LocalNodePolicy;
  port: number;
  host: string;
  /** Origin allowed to read; plans are authorised by signature regardless. */
  allowedOrigin?: string;
}

interface Heartbeat {
  startedAt: string;
  lastPlanId: string | null;
  lastVerdict: string | null;
  plansAdmitted: number;
  plansRejected: number;
}

function json(res: ServerResponse, status: number, body: unknown, origin?: string) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
    ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
  });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 1_000_000) throw new Error("Anfrage zu groß.");
    chunks.push(chunk as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function createRunnerServer(options: ServerOptions) {
  const { identity, root, adapters, policy } = options;
  const nonces = new MemoryNonceStore();
  let pairing: PairingState;

  const heartbeat: Heartbeat = {
    startedAt: new Date().toISOString(),
    lastPlanId: null,
    lastVerdict: null,
    plansAdmitted: 0,
    plansRejected: 0,
  };

  const guard = (): GuardContext => ({
    nodeId: identity.nodeId,
    authorizedPublicKey: pairing.authorizedPublicKey,
    adapters,
    policy,
    nonces,
  });

  const server = createServer(async (req, res) => {
    const origin = options.allowedOrigin;
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        ...(origin ? { "Access-Control-Allow-Origin": origin } : {}),
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    try {
      if (req.method === "GET" && url.pathname === "/v1/hello") {
        return json(
          res,
          200,
          {
            nodeId: identity.nodeId,
            runnerVersion: RUNNER_VERSION,
            publicKey: identity.publicKey,
            fingerprint: await fingerprint(identity.publicKey),
            paired: Boolean(pairing.authorizedPublicKey),
            pairedFingerprint: pairing.authorizedFingerprint,
            adapters: adapters.ids(),
            supportedSteps: adapters.supportedKinds(),
            policy,
          },
          origin,
        );
      }

      if (req.method === "GET" && url.pathname === "/v1/state") {
        return json(res, 200, { ...heartbeat, uptimeSeconds: Math.round(process.uptime()) }, origin);
      }

      if (req.method === "GET" && url.pathname === "/v1/snapshot") {
        return json(res, 200, await takeSnapshot(identity.nodeId, root), origin);
      }

      if (req.method === "GET" && url.pathname === "/v1/probe") {
        return json(res, 200, await probeNode(identity.nodeId, root), origin);
      }

      if (req.method === "POST" && url.pathname === "/v1/pair") {
        const body = (await readBody(req)) as { code?: string; publicKey?: string };
        if (!body?.code || !body?.publicKey) {
          return json(res, 400, { error: "code und publicKey sind erforderlich." }, origin);
        }
        const result = await completePairing(pairing, { code: body.code, publicKey: body.publicKey });
        if (!result.ok) return json(res, 409, { error: result.reason }, origin);

        pairing = result.state;
        await savePairing(root, pairing);
        return json(res, 200, { paired: true, fingerprint: result.fingerprint }, origin);
      }

      if (req.method === "POST" && url.pathname === "/v1/apply") {
        const verdict = await admitPlan(await readBody(req), guard());
        if (!verdict.ok) {
          heartbeat.plansRejected += 1;
          return json(res, 403, { rejected: verdict.rejection }, origin);
        }
        heartbeat.plansAdmitted += 1;
        const report = await executePlan(verdict.plan, { nodeId: identity.nodeId, root, adapters });
        heartbeat.lastPlanId = report.planId;
        heartbeat.lastVerdict = report.verdict;
        return json(res, 200, report, origin);
      }

      return json(res, 404, { error: "Unbekannter Endpunkt." }, origin);
    } catch (err) {
      return json(res, 400, { error: (err as Error).message }, origin);
    }
  });

  return {
    server,
    async start() {
      pairing = await loadPairing(root);
      await new Promise<void>((resolve) => server.listen(options.port, options.host, resolve));
      return { host: options.host, port: options.port, pairing };
    },
    /** Opens a pairing window and returns the one-time code for the console. */
    async openPairing() {
      pairing = await loadPairing(root);
      const { code, until } = beginPairing();
      pairing = { ...pairing, pendingCode: code, pendingUntil: until };
      await savePairing(root, pairing);
      return { code, until };
    },
    stop() {
      return new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
