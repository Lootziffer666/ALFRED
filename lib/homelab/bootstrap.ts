import type { NodeOs } from "../schema/homelab";

/**
 * Bootstrap packages (plan §17.1). Not "here is a zip, good luck": ALFRET
 * writes the script, the user runs it once on the machine, and the runner
 * installs itself, makes its own key pair and shows a one-time pairing code.
 *
 * Two things the scripts deliberately do not do: they do not pipe a download
 * into a shell, and they do not install anything beyond the runner. Whether
 * this machine may ever install a runtime is decided on the machine, with
 * `--allow-install`, and not by anything ALFRET sends later.
 */

export interface BootstrapOptions {
  os: NodeOs;
  /** Where the runner keeps its identity and pairing state. */
  root?: string;
  port?: number;
  /** The ALFRET origin allowed to read this runner's endpoints. */
  origin?: string;
  repository?: string;
}

export interface BootstrapPackage {
  filename: string;
  shell: string;
  script: string;
  /** The single command to run on the machine. */
  command: string;
  notes: string[];
}

const DEFAULT_REPOSITORY = "https://github.com/Lootziffer666/ALFRED";

function shared(options: BootstrapOptions) {
  return {
    port: options.port ?? 7717,
    repository: options.repository ?? DEFAULT_REPOSITORY,
    origin: options.origin ?? "http://localhost:3000",
  };
}

function posixScript(options: BootstrapOptions, root: string): string {
  const { port, repository, origin } = shared(options);
  return `#!/bin/sh
# ALFRET Runner — Bootstrap
# Installiert den Runner, erzeugt sein Schlüsselpaar und zeigt einen
# einmaligen Pairing-Code. Es wird nichts installiert, was darüber hinausgeht.
set -eu

ROOT="\${ALFRET_ROOT:-${root}}"
PORT="\${ALFRET_PORT:-${port}}"

if ! command -v bun >/dev/null 2>&1; then
  echo "Bun fehlt. Bitte einmal installieren: https://bun.sh"
  echo "Bewusst nicht automatisch — dieses Skript lädt nichts nach."
  exit 1
fi

mkdir -p "$ROOT"
if [ ! -d "$ROOT/src" ]; then
  echo "Runner-Quellen werden nach $ROOT geholt."
  git clone --depth 1 ${repository} "$ROOT/checkout"
  ln -sfn "$ROOT/checkout/runner/src" "$ROOT/src"
fi

echo
echo "Pairing-Code wird erzeugt."
bun "$ROOT/src/index.ts" pair --root "$ROOT"

echo "Runner starten mit:"
echo "  bun $ROOT/src/index.ts --root $ROOT --port $PORT --origin ${origin}"
echo
echo "Nur lesend. Für die Windows-Etappe zusaetzlich --allow-install."
`;
}

function powershellScript(options: BootstrapOptions, root: string): string {
  const { port, repository, origin } = shared(options);
  return `# ALFRET Runner — Bootstrap (Windows)
# Installiert den Runner, erzeugt sein Schluesselpaar und zeigt einen
# einmaligen Pairing-Code.
$ErrorActionPreference = "Stop"

$Root = if ($env:ALFRET_ROOT) { $env:ALFRET_ROOT } else { "${root}" }
$Port = if ($env:ALFRET_PORT) { $env:ALFRET_PORT } else { ${port} }

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  Write-Host "Bun fehlt. Bitte einmal installieren: https://bun.sh"
  Write-Host "Bewusst nicht automatisch — dieses Skript laedt nichts nach."
  exit 1
}

New-Item -ItemType Directory -Force -Path $Root | Out-Null
if (-not (Test-Path "$Root\\checkout")) {
  Write-Host "Runner-Quellen werden nach $Root geholt."
  git clone --depth 1 ${repository} "$Root\\checkout"
}

Write-Host ""
Write-Host "Pairing-Code wird erzeugt."
bun "$Root\\checkout\\runner\\src\\index.ts" pair --root $Root

Write-Host "Runner starten mit:"
Write-Host "  bun $Root\\checkout\\runner\\src\\index.ts --root $Root --port $Port --origin ${origin}"
Write-Host ""
Write-Host "Nur lesend. Fuer die Windows-Etappe zusaetzlich --allow-install."
`;
}

export function buildBootstrap(options: BootstrapOptions): BootstrapPackage {
  const { port } = shared(options);

  if (options.os === "windows") {
    const root = options.root ?? "$env:LOCALAPPDATA\\alfret-runner";
    return {
      filename: "alfret-runner-bootstrap.ps1",
      shell: "powershell",
      script: powershellScript(options, root),
      command: "powershell -ExecutionPolicy Bypass -File .\\alfret-runner-bootstrap.ps1",
      notes: [
        "Bun und git müssen vorhanden sein — das Skript lädt bewusst nichts nach.",
        `Der Runner hört auf 127.0.0.1:${port}. Von außen erreichbar wird er über Tailscale, nicht über eine weitere Bindung.`,
        "Ohne --allow-install darf dieser Node nichts installieren, egal was ein Plan verlangt.",
      ],
    };
  }

  const termux = options.os === "android";
  const root = options.root ?? (termux ? "$HOME/.alfret-runner" : "$HOME/.alfret-runner");

  return {
    filename: termux ? "alfret-runner-bootstrap-termux.sh" : "alfret-runner-bootstrap.sh",
    shell: "sh",
    script: posixScript(options, root),
    command: `sh ./${termux ? "alfret-runner-bootstrap-termux.sh" : "alfret-runner-bootstrap.sh"}`,
    notes: [
      "Bun und git müssen vorhanden sein — das Skript lädt bewusst nichts nach.",
      `Der Runner hört auf 127.0.0.1:${port}. Von außen erreichbar wird er über Tailscale, nicht über eine weitere Bindung.`,
      termux
        ? "In Termux zusätzlich termux-services einrichten, damit der Runner nicht dauerhaft im Hintergrund läuft."
        : "Als systemd-Unit einrichten, wenn der Node dauerhaft verfügbar sein soll.",
      "Ohne --allow-install darf dieser Node nichts installieren, egal was ein Plan verlangt.",
    ],
  };
}
