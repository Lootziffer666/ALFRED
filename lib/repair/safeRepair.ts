// Stage 4 — executeRepair und validateRepair mit echter Logik.
// Nur für Finding-Kinds mit autoFixable: true (aktuell: doc-update-needed).
// Baut PlannedWrite über repairReadme.ts — kein doppelter Pfad.

import type { AlfretStore } from "../store/types";
import type { FindingCapsule } from "../findings/capsule";
import type { PlannedWrite } from "../daemon/jobs/types";
import { buildReadmeRepair } from "../readme/repairReadme";
import { ghFetch } from "../github";

const DAEMON_AUTHOR = "alfret-daemon[bot]";
const FIXABLE_KINDS = new Set(["doc-update-needed"]);

export interface RepairValidation {
  repairable: boolean;
  reason: string;
  capsule?: FindingCapsule;
}

export async function validateRepair(
  store: AlfretStore,
  findingCapsuleId: string,
): Promise<RepairValidation> {
  const capsule = await store.get<FindingCapsule & { kind: "finding-capsule" }>(
    "finding-capsule",
    findingCapsuleId,
  );

  if (!capsule) {
    return { repairable: false, reason: "Finding nicht gefunden." };
  }

  if (!capsule.finding.autoFixable) {
    return { repairable: false, reason: "Finding ist nicht automatisch reparierbar.", capsule };
  }

  if (!FIXABLE_KINDS.has(capsule.finding.kind)) {
    return {
      repairable: false,
      reason: `Finding-Kind «${capsule.finding.kind}» wird noch nicht unterstützt.`,
      capsule,
    };
  }

  return { repairable: true, reason: "Reparatur möglich.", capsule };
}

export async function executeRepair(
  store: AlfretStore,
  findingCapsuleId: string,
  token: string,
): Promise<{ ok: boolean; writes: PlannedWrite[]; reason: string }> {
  const validation = await validateRepair(store, findingCapsuleId);

  if (!validation.repairable || !validation.capsule) {
    return { ok: false, writes: [], reason: validation.reason };
  }

  const capsule = validation.capsule;
  const [owner, name] = capsule.repository.split("/");

  // README-Inhalt laden
  const readmeResult = await ghFetch<{ content: string }>(
    `https://api.github.com/repos/${owner}/${name}/contents/README.md`,
    token,
  );

  if (!readmeResult.ok || !readmeResult.data) {
    return { ok: false, writes: [], reason: "README konnte nicht geladen werden." };
  }

  const readmeContent = Buffer.from(readmeResult.data.content, "base64").toString("utf-8");
  const branchName = `alfret/repair-readme-${Date.now()}`;

  const repair = buildReadmeRepair({
    repository: capsule.repository,
    readmeContent,
    branchName,
    prNumber: 0,
    daemonAuthor: DAEMON_AUTHOR,
  });

  if (!repair.changed) {
    return { ok: false, writes: [], reason: repair.reason };
  }

  return { ok: true, writes: repair.writes, reason: "PlannedWrites erzeugt." };
}
