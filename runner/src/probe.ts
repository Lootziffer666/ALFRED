import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import { readFile } from "node:fs/promises";
import { statfs } from "node:fs";
import type { Gpu, NodeObservation, NodeOs, ResourceSnapshot } from "../../lib/schema/homelab";

/**
 * Hardware probe (plan §13.1). ALFRET does not ask for what the machine can be
 * asked directly.
 *
 * Every external call goes through `execFile` with an argument vector — no
 * shell is involved anywhere in this file, so nothing a tool prints can turn
 * into a command. A tool that is missing is simply absent from the result; it
 * is never guessed at.
 */

const run = promisify(execFile);
const statfsAsync = promisify(statfs);

const RUNNER_VERSION = "0.1.0";

async function tryRun(command: string, args: string[], timeoutMs = 8000): Promise<string | null> {
  try {
    const { stdout } = await run(command, args, { timeout: timeoutMs, windowsHide: true });
    return stdout.trim();
  } catch {
    return null;
  }
}

async function hasBinary(command: string): Promise<string | null> {
  const probe = process.platform === "win32" ? ["where", command] : ["which", command];
  const found = await tryRun(probe[0], probe.slice(1), 4000);
  return found ? found.split(/\r?\n/)[0].trim() : null;
}

function currentOs(): NodeOs {
  if (process.platform === "win32") return "windows";
  if (process.platform === "darwin") return "macos";
  if (process.env.ANDROID_ROOT || process.env.PREFIX?.includes("com.termux")) return "android";
  return "linux";
}

/** `nvidia-smi` in machine-readable form. Absent GPU simply yields nothing. */
async function probeNvidia(): Promise<Gpu[]> {
  const out = await tryRun("nvidia-smi", [
    "--query-gpu=name,memory.total,display_active",
    "--format=csv,noheader,nounits",
  ]);
  if (!out) return [];

  return out
    .split(/\r?\n/)
    .map((line) => line.split(",").map((v) => v.trim()))
    .filter((parts) => parts.length >= 2 && parts[0])
    .map((parts) => ({
      vendor: "nvidia" as const,
      model: parts[0],
      // nvidia-smi reports mebibytes.
      vramGb: Math.round((Number(parts[1]) * 1024 * 1024) / 1e9 * 100) / 100,
      drivesDisplay: (parts[2] ?? "").toLowerCase() === "enabled",
    }));
}

async function probeAccelerators(): Promise<NodeObservation["accelerators"]> {
  const found: NodeObservation["accelerators"] = [];
  if (await hasBinary("nvidia-smi")) found.push("cuda");
  if (await hasBinary("rocminfo")) found.push("rocm");
  if (process.platform === "darwin") found.push("metal");
  if (await hasBinary("vulkaninfo")) found.push("vulkan");
  return found;
}

const TOOLCHAINS = ["python3", "python", "bun", "node", "java", "dotnet", "docker", "podman", "blender", "godot"];
const RUNTIMES = ["ollama", "llama-server", "vllm"];

async function probeInstalled(names: string[]): Promise<{ id: string; version?: string }[]> {
  const found: { id: string; version?: string }[] = [];
  for (const name of names) {
    if (!(await hasBinary(name))) continue;
    const version = (await tryRun(name, ["--version"], 5000)) ?? undefined;
    found.push({ id: name, version: version?.split(/\r?\n/)[0]?.slice(0, 80) });
  }
  return found;
}

async function probeOllamaModels(): Promise<string[]> {
  const out = await tryRun("ollama", ["list"]);
  if (!out) return [];
  return out
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(/\s+/)[0])
    .filter(Boolean);
}

async function diskFreeGb(path: string): Promise<number> {
  try {
    const stats = await statfsAsync(path);
    return Math.round((Number(stats.bavail) * Number(stats.bsize)) / 1e9 * 100) / 100;
  } catch {
    return 0;
  }
}

async function isWsl(): Promise<boolean> {
  if (process.platform !== "linux") return false;
  try {
    const release = await readFile("/proc/sys/kernel/osrelease", "utf8");
    return /microsoft/i.test(release);
  } catch {
    return false;
  }
}

async function osVersion(): Promise<string | undefined> {
  if (process.platform === "linux") {
    try {
      const release = await readFile("/etc/os-release", "utf8");
      return release.match(/^PRETTY_NAME="?([^"\n]+)"?/m)?.[1];
    } catch {
      return os.release();
    }
  }
  return os.release();
}

export async function probeNode(nodeId: string, root: string): Promise<NodeObservation> {
  const cpus = os.cpus();
  const gpus = await probeNvidia();

  return {
    nodeId,
    observedAt: new Date().toISOString(),
    runnerVersion: RUNNER_VERSION,
    cpu: cpus[0]?.model?.trim() || "unbekannt",
    arch: os.arch(),
    cores: Math.max(1, os.availableParallelism?.() ?? cpus.length),
    threads: Math.max(1, cpus.length),
    ramGb: Math.round((os.totalmem() / 1e9) * 100) / 100,
    gpus,
    os: currentOs(),
    osVersion: await osVersion(),
    wsl: await isWsl(),
    virtualized: Boolean(await tryRun("systemd-detect-virt", ["--quiet"], 3000)),
    diskFreeGb: await diskFreeGb(root),
    accelerators: await probeAccelerators(),
    runtimes: await probeInstalled(RUNTIMES),
    toolchains: await probeInstalled(TOOLCHAINS),
    installedModels: await probeOllamaModels(),
    evidence: [
      { source: `runner ${RUNNER_VERSION} · ${os.platform()} ${os.release()}`, observedAt: new Date().toISOString() },
    ],
  };
}

// ── Resource snapshot (plan §14.4) ──────────────────────────────────────────

async function freeVram(): Promise<{ freeGb: number; loads: number[]; resident: { modelId: string; vramGb: number }[] }> {
  const memory = await tryRun("nvidia-smi", ["--query-gpu=memory.free,utilization.gpu", "--format=csv,noheader,nounits"]);
  if (!memory) return { freeGb: 0, loads: [], resident: [] };

  const rows = memory
    .split(/\r?\n/)
    .map((line) => line.split(",").map((v) => Number(v.trim())))
    .filter((parts) => parts.length >= 2 && Number.isFinite(parts[0]));

  const freeGb = rows.reduce((max, r) => Math.max(max, (r[0] * 1024 * 1024) / 1e9), 0);
  const loads = rows.map((r) => Math.min(1, Math.max(0, r[1] / 100)));

  // What Ollama currently holds, so admission knows what could be freed.
  const ps = await tryRun("ollama", ["ps"]);
  const resident = (ps ?? "")
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim().split(/\s{2,}/))
    .filter((parts) => parts.length >= 3 && parts[0])
    .map((parts) => {
      const size = parts.find((p) => /\d+(\.\d+)?\s*(GB|MB)/i.test(p)) ?? "0 GB";
      const value = Number(size.match(/[\d.]+/)?.[0] ?? 0);
      return { modelId: parts[0], vramGb: /MB/i.test(size) ? value / 1000 : value };
    });

  return { freeGb: Math.round(freeGb * 100) / 100, loads, resident };
}

async function battery(): Promise<{ percent?: number; onAc?: boolean }> {
  if (process.platform !== "linux") return {};
  try {
    const capacity = await readFile("/sys/class/power_supply/BAT0/capacity", "utf8");
    const status = await readFile("/sys/class/power_supply/BAT0/status", "utf8");
    return { percent: Number(capacity.trim()), onAc: /charging|full/i.test(status) };
  } catch {
    return {};
  }
}

export async function takeSnapshot(nodeId: string, root: string, validForSeconds = 120): Promise<ResourceSnapshot> {
  const vram = await freeVram();
  const load = os.loadavg()[0] / Math.max(1, os.cpus().length);
  const power = await battery();

  return {
    nodeId,
    takenAt: new Date().toISOString(),
    validForSeconds,
    freeRamGb: Math.round((os.freemem() / 1e9) * 100) / 100,
    freeVramGb: vram.freeGb,
    cpuLoad: Math.min(1, Math.max(0, load)),
    gpuLoad: vram.loads.length ? Math.max(...vram.loads) : 0,
    diskFreeGb: await diskFreeGb(root),
    runningJobs: 0,
    residentModels: vram.resident,
    batteryPercent: power.percent,
    onAcPower: power.onAc,
    // Neither of these can be measured reliably from a headless service, and a
    // guess here would let a job start while somebody is working.
    thermal: "unknown",
    userActive: false,
  };
}

export { RUNNER_VERSION };
