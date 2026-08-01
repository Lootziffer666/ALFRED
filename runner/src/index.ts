import path from "node:path";
import os from "node:os";
import { fingerprint } from "../../lib/homelab/signing";
import { loadOrCreateIdentity, loadPairing } from "./identity";
import { readOnlyRegistry, fullRegistry } from "./adapters";
import { READ_ONLY_POLICY, type LocalNodePolicy } from "./guard";
import { createRunnerServer } from "./server";
import { probeNode } from "./probe";

/**
 * ALFRET Runner — command line entry.
 *
 *   bun runner/src/index.ts                 start, reading only
 *   bun runner/src/index.ts pair            open a one-time pairing window
 *   bun runner/src/index.ts probe           print this machine's hardware
 *   bun runner/src/index.ts --allow-install start with the Ollama adapter
 *
 * Reading is the default. Installing anything requires saying so on the
 * machine itself — a plan cannot grant itself that right.
 */

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function has(flag: string): boolean {
  return process.argv.includes(`--${flag}`);
}

async function main() {
  const command = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "serve";
  const root = path.resolve(arg("root", path.join(os.homedir(), ".alfret-runner"))!);
  const identity = await loadOrCreateIdentity(root);

  if (command === "probe") {
    console.log(JSON.stringify(await probeNode(identity.nodeId, root), null, 2));
    return;
  }

  const allowInstall = has("allow-install");
  const adapters = allowInstall ? fullRegistry() : readOnlyRegistry();
  const policy: LocalNodePolicy = allowInstall
    ? { allowInstall: true, allowedAdapters: adapters.ids(), refusedKinds: [] }
    : READ_ONLY_POLICY;

  const runner = createRunnerServer({
    identity,
    root,
    adapters,
    policy,
    port: Number(arg("port", "7717")),
    host: arg("host", "127.0.0.1")!,
    allowedOrigin: arg("origin"),
  });

  if (command === "pair") {
    const { code, until } = await runner.openPairing();
    console.log(`\nNode-ID     ${identity.nodeId}`);
    console.log(`Fingerprint ${await fingerprint(identity.publicKey)}`);
    console.log(`\nPairing-Code: ${code}`);
    console.log(`Gültig bis:   ${until}`);
    console.log("\nDiesen Code in ALFRET eingeben und den Fingerprint vergleichen.\n");
    return;
  }

  const { host, port, pairing } = await runner.start();
  console.log(`ALFRET Runner ${identity.nodeId} auf http://${host}:${port}`);
  console.log(`Fingerprint   ${await fingerprint(identity.publicKey)}`);
  console.log(`Pairing       ${pairing.authorizedPublicKey ? `an ${pairing.authorizedFingerprint}` : "offen"}`);
  console.log(`Adapter       ${adapters.ids().join(", ")}`);
  console.log(`Installieren  ${policy.allowInstall ? "erlaubt" : "gesperrt"}`);

  const shutdown = () => {
    void runner.stop().then(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

/** Only run when invoked directly, so the module stays importable in tests. */
if (process.argv[1]?.includes("runner")) {
  main().catch((err) => {
    console.error(`Runner konnte nicht starten: ${(err as Error).message}`);
    process.exit(1);
  });
}

export { loadPairing };
