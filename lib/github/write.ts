// Etappe 27: Die einzige Funktion im Repo, die mutierenden Request absetzt.
// executeWrite mappt kind → ScopeAction, ruft assertScope, prüft bei commit-files
// jeden Pfad gegen isPathProtected und verweigert GANZ statt teilweise.
// Bei dryRun: {ok:true, applied:false} ohne Request.
//
// Blob → Tree → Commit → updateRef = vier Requests für beliebig viele Dateien,
// ein Commit, optimistische Nebenläufigkeit (409 → nächster Tick versucht erneut).

import { ghFetch } from "../github";
import { assertScope, isPathProtected } from "../scope";
import { EMPTY_SCOPE_REGISTRY } from "../scope/index";
import type { ScopeRegistry } from "../scope/types";
import type { PlannedWrite } from "../daemon/jobs/types";

export const WRITE_KIND_TO_SCOPE_ACTION: Record<PlannedWrite["kind"], string> = {
  "commit-files": "commitFiles",
  "create-branch": "createBranch",
  "delete-branch": "destructiveCleanup",
  "create-pr": "createPullRequest",
  "update-pr-branch": "updatePrBranch",
};

export interface ExecuteWriteResult {
  ok: boolean;
  applied: boolean;
  reason?: string;
  detail?: Record<string, unknown>;
}

export interface ExecuteWriteOptions {
  token: string;
  dryRun: boolean;
  armed: boolean;
  /**
   * Die Freigaben aus ~/.alfret/scope.json. Fehlt sie, gilt die leere Registry
   * — dann ist kein Repository freigegeben und jeder Write wird verweigert.
   */
  scope?: ScopeRegistry;
  fetchImpl?: typeof fetch;
}

export async function executeWrite(
  write: PlannedWrite,
  opts: ExecuteWriteOptions,
): Promise<ExecuteWriteResult> {
  const scopeAction = WRITE_KIND_TO_SCOPE_ACTION[write.kind];
  const scope = opts.scope ?? EMPTY_SCOPE_REGISTRY;

  // 1. Scope-Prüfung zuerst — wirft bei unbekanntem/disarmed Repo oder bei
  //    einer Aktion, die dieses Repository nicht freigegeben hat.
  try {
    assertScope(scope, write.repository, scopeAction, { armed: opts.armed });
  } catch (err) {
    return { ok: false, applied: false, reason: String(err) };
  }

  // 2. Geschützte Pfade — nur relevant bei commit-files. Verweigert GANZ, nicht teilweise.
  if (write.kind === "commit-files") {
    const payload = write.payload as { files: Array<{ path: string }> };
    const protectedHit = payload.files.find((f) =>
      isPathProtected(scope, write.repository, f.path),
    );
    if (protectedHit) {
      return {
        ok: false,
        applied: false,
        reason: `Pfad "${protectedHit.path}" ist geschützt — gesamter Commit verweigert.`,
      };
    }
  }

  // 3. Dry-Run — kein Request, aber der volle Pfad wurde durchlaufen.
  if (opts.dryRun) {
    return { ok: true, applied: false, reason: "dryRun" };
  }

  // 4. Tatsächliche Ausführung, per kind.
  switch (write.kind) {
    case "commit-files":
      return runCommitFiles(write, opts);
    case "create-branch":
      return runCreateBranch(write, opts);
    case "delete-branch":
      return runDeleteBranch(write, opts);
    case "create-pr":
      return runCreatePr(write, opts);
    case "update-pr-branch":
      return runUpdatePrBranch(write, opts);
  }
}

// Blob → Tree → Commit → updateRef (4 Requests, 1 Commit)
async function runCommitFiles(
  write: PlannedWrite,
  opts: ExecuteWriteOptions,
): Promise<ExecuteWriteResult> {
  const payload = write.payload as {
    branch: string;
    message: string;
    files: Array<{ path: string; content: string }>;
  };

  const [owner, repo] = write.repository.split("/");
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const { token, fetchImpl } = opts;

  const refResult = await ghFetch<{ object: { sha: string } }>(
    `${base}/git/ref/heads/${payload.branch}`,
    token,
    { fetchImpl },
  );

  if (!refResult.ok || !refResult.data) {
    return { ok: false, applied: false, reason: `ref nicht gefunden: ${refResult.error}` };
  }

  const baseSha = refResult.data.object.sha;

  const blobs = await Promise.all(
    payload.files.map((f) =>
      ghFetch<{ sha: string }>(`${base}/git/blobs`, token, {
        method: "POST",
        fetchImpl,
        body: { content: Buffer.from(f.content).toString("base64"), encoding: "base64" },
      }),
    ),
  );

  const failedBlob = blobs.find((b) => !b.ok || !b.data);
  if (failedBlob) {
    return { ok: false, applied: false, reason: `Blob-Erstellung fehlgeschlagen: ${failedBlob.error}` };
  }

  const treeResult = await ghFetch<{ sha: string }>(`${base}/git/trees`, token, {
    method: "POST",
    fetchImpl,
    body: {
      base_tree: baseSha,
      tree: payload.files.map((f, i) => ({
        path: f.path,
        mode: "100644",
        type: "blob",
        sha: blobs[i].data!.sha,
      })),
    },
  });

  if (!treeResult.ok || !treeResult.data) {
    return { ok: false, applied: false, reason: `Tree-Erstellung fehlgeschlagen: ${treeResult.error}` };
  }

  const commitResult = await ghFetch<{ sha: string; html_url: string }>(
    `${base}/git/commits`,
    token,
    {
      method: "POST",
      fetchImpl,
      body: { message: payload.message, tree: treeResult.data.sha, parents: [baseSha] },
    },
  );

  if (!commitResult.ok || !commitResult.data) {
    return { ok: false, applied: false, reason: `Commit-Erstellung fehlgeschlagen: ${commitResult.error}` };
  }

  const updateResult = await ghFetch(`${base}/git/refs/heads/${payload.branch}`, token, {
    method: "PATCH",
    fetchImpl,
    body: { sha: commitResult.data.sha, force: false },
  });

  if (!updateResult.ok) {
    if (updateResult.status === 409) {
      return {
        ok: false,
        applied: false,
        reason: "409: Branch ist weitergelaufen, nächster Tick versucht erneut.",
      };
    }
    return { ok: false, applied: false, reason: `Ref-Update fehlgeschlagen: ${updateResult.error}` };
  }

  return {
    ok: true,
    applied: true,
    detail: { sha: commitResult.data.sha, html_url: commitResult.data.html_url },
  };
}

async function runCreateBranch(
  write: PlannedWrite,
  opts: ExecuteWriteOptions,
): Promise<ExecuteWriteResult> {
  const payload = write.payload as { branch: string; fromBranch?: string };
  const [owner, repo] = write.repository.split("/");
  const base = `https://api.github.com/repos/${owner}/${repo}`;

  const fromBranch = payload.fromBranch;
  let baseSha: string;

  if (fromBranch) {
    const r = await ghFetch<{ object: { sha: string } }>(
      `${base}/git/ref/heads/${fromBranch}`,
      opts.token,
      { fetchImpl: opts.fetchImpl },
    );
    if (!r.ok || !r.data) return { ok: false, applied: false, reason: r.error };
    baseSha = r.data.object.sha;
  } else {
    const meta = await ghFetch<{ default_branch: string }>(base, opts.token, {
      fetchImpl: opts.fetchImpl,
    });
    if (!meta.ok || !meta.data) return { ok: false, applied: false, reason: meta.error };

    const r = await ghFetch<{ object: { sha: string } }>(
      `${base}/git/ref/heads/${meta.data.default_branch}`,
      opts.token,
      { fetchImpl: opts.fetchImpl },
    );
    if (!r.ok || !r.data) return { ok: false, applied: false, reason: r.error };
    baseSha = r.data.object.sha;
  }

  const result = await ghFetch<{ ref: string; object: { sha: string } }>(
    `${base}/git/refs`,
    opts.token,
    {
      method: "POST",
      fetchImpl: opts.fetchImpl,
      body: { ref: `refs/heads/${payload.branch}`, sha: baseSha },
    },
  );

  if (!result.ok || !result.data) return { ok: false, applied: false, reason: result.error };
  return { ok: true, applied: true, detail: { ref: result.data.ref, sha: result.data.object.sha } };
}

async function runDeleteBranch(
  write: PlannedWrite,
  opts: ExecuteWriteOptions,
): Promise<ExecuteWriteResult> {
  const payload = write.payload as { branch: string };
  const [owner, repo] = write.repository.split("/");

  const result = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${payload.branch}`,
    opts.token,
    { method: "DELETE", fetchImpl: opts.fetchImpl },
  );

  if (!result.ok) return { ok: false, applied: false, reason: result.error };
  return { ok: true, applied: true };
}

async function runCreatePr(
  write: PlannedWrite,
  opts: ExecuteWriteOptions,
): Promise<ExecuteWriteResult> {
  const payload = write.payload as {
    title: string;
    body: string;
    head: string;
    base: string;
    draft?: boolean;
  };
  const [owner, repo] = write.repository.split("/");

  const result = await ghFetch<{ number: number; html_url: string }>(
    `https://api.github.com/repos/${owner}/${repo}/pulls`,
    opts.token,
    {
      method: "POST",
      fetchImpl: opts.fetchImpl,
      body: { ...payload, draft: payload.draft ?? false },
    },
  );

  if (!result.ok || !result.data) return { ok: false, applied: false, reason: result.error };
  return { ok: true, applied: true, detail: { number: result.data.number, html_url: result.data.html_url } };
}

async function runUpdatePrBranch(
  write: PlannedWrite,
  opts: ExecuteWriteOptions,
): Promise<ExecuteWriteResult> {
  const payload = write.payload as { pullNumber: number };
  const [owner, repo] = write.repository.split("/");

  const result = await ghFetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${payload.pullNumber}/update-branch`,
    opts.token,
    { method: "PUT", fetchImpl: opts.fetchImpl, body: {} },
  );

  if (!result.ok) return { ok: false, applied: false, reason: result.error };
  return { ok: true, applied: true };
}
