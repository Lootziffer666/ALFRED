"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { extract, buildMetaAtoms } from "@/lib/atoms/extract";
import { SHADED_SIGNALS } from "@/lib/atoms/data";
import { composeFallback, buildPrompts, parseKI, renderAudited, type Assessment, type Mode, type RenderedPhase } from "@/lib/atoms/compose";
import type { Atom, Signals } from "@/lib/atoms/types";
import { buildRepos, ingestFile, readReadme } from "@/lib/sqlite/engine";
import type { IngestedFile, RepoRecord } from "@/lib/sqlite/types";

export type SortKey = "stars" | "az" | "classified";

export interface KiConfig {
  endpoint: string;
  model: string;
  key: string;
  ki: boolean;
  stream: boolean;
}

export interface DbStatus {
  kind: "info" | "ok" | "err";
  html: string;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function useArchive() {
  const [files, setFiles] = useState<IngestedFile[]>([]);
  const [repos, setRepos] = useState<RepoRecord[]>([]);
  const [dbStatus, setDbStatus] = useState<DbStatus>({
    kind: "info",
    html: "Bereit. Zieh eine oder mehrere .sqlite / .db herein – Alfred inspiziert das Schema, bevor er einen Satz setzt.",
  });

  const [mode, setMode] = useState<Mode>("single");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("stars");
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<string>>(new Set());
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null);

  const [signals, setSignals] = useState<Signals>(SHADED_SIGNALS);
  const [assess, setAssess] = useState<Assessment | null>(null);
  const [level, setLevelState] = useState<1 | 2 | 3 | 4>(2);
  const [atoms, setAtoms] = useState<Atom[]>(() => extract(SHADED_SIGNALS));
  const [metaTotal, setMetaTotal] = useState(0);

  const [manual, setManual] = useState({ readme: "", const: "", tree: "", commits: "", conv: "" });

  const [light, setLight] = useState<{ active: boolean; current: number; total: number; label: string }>({
    active: false,
    current: 0,
    total: 0,
    label: "",
  });
  const lightAbort = useRef(false);

  const [cfg, setCfg] = useState<KiConfig>({ endpoint: "", model: "", key: "", ki: true, stream: false });
  const [testResult, setTestResult] = useState<string | null>(null);

  const [report, setReport] = useState<RenderedPhase[] | null>(null);
  const [reportMode, setReportMode] = useState<"fallback" | "ki" | null>(null);
  // Increments every time a new report is composed, purely so the UI can key
  // a one-shot "ink pulse" animation off it (see app/archive/page.tsx) —
  // ordinary state, updated only from event-handler code paths below, never
  // from an effect or during render.
  const [reportVersion, setReportVersion] = useState(0);
  const applyReport = useCallback((next: RenderedPhase[] | null, nextMode: "fallback" | "ki" | null) => {
    setReport(next);
    setReportMode(nextMode);
    setReportVersion((v) => v + 1);
  }, []);
  const [kiLoading, setKiLoading] = useState(false);
  const [kiLiveText, setKiLiveText] = useState("");
  const [kiStats, setKiStats] = useState({ ki: 0, bad: 0 });
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((cur) => (cur === msg ? null : cur)), 3600);
  }, []);

  const dbFileNames = useMemo(() => files.map((f) => f.fileName), [files]);

  const press = useCallback(
    async (useKI: boolean) => {
      if (useKI && cfg.ki && cfg.endpoint) {
        setKiLoading(true);
        setKiLiveText("");
        try {
          const { system, user } = buildPrompts({ atoms, level, mode, signals, assess });
          const ep = cfg.endpoint.replace(/\/+$/, "");
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (cfg.key) headers.Authorization = `Bearer ${cfg.key}`;
          const body = {
            model: cfg.model || "default",
            messages: [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            temperature: 0.8,
            stream: cfg.stream,
          };
          const res = await fetch(`${ep}/chat/completions`, { method: "POST", headers, body: JSON.stringify(body) });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          let text: string;
          if (cfg.stream && res.body) {
            text = await readStream(res.body, setKiLiveText);
          } else {
            const j = await res.json();
            text = j.choices?.[0]?.message?.content ?? "";
          }

          const { sections, unused, kiCount, badCount } = parseKI(text, atoms);
          setKiStats({ ki: kiCount, bad: badCount });
          applyReport(
            renderAudited({
              sections,
              atoms,
              level,
              mode,
              metaTotal,
              dbFileNames,
              assess,
            }),
            "ki",
          );
          void unused;
          toast(badCount ? `CUE hat ${badCount} KI-Behauptung(en) ohne Atom rot markiert.` : "KI-Prosa vollständig durch Atome gedeckt.");
        } catch (err) {
          applyReport(composeFallback({ atoms, level, mode, metaTotal, dbFileNames, assess }), "fallback");
          setKiStats({ ki: 0, bad: 0 });
          toast(`KI nicht erreichbar (${(err as Error).message}) – Fallback-Skelett.`);
        } finally {
          setKiLoading(false);
        }
      } else {
        applyReport(composeFallback({ atoms, level, mode, metaTotal, dbFileNames, assess }), "fallback");
        setKiStats({ ki: 0, bad: 0 });
      }
    },
    [atoms, level, mode, signals, assess, cfg, metaTotal, dbFileNames, toast, applyReport],
  );

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const arr = [...fileList].filter((f) => /\.(sqlite|db|sqlite3)$/i.test(f.name));
      if (!arr.length) {
        toast("Keine .sqlite/.db darunter.");
        return;
      }
      setDbStatus({ kind: "info", html: "sql.js lädt / öffnet …" });
      const nextFiles = [...files];
      for (const f of arr) {
        try {
          const entry = await ingestFile(f);
          nextFiles.push(entry);
          setDbStatus({ kind: "ok", html: `✓ ${entry.fileName} geöffnet · ${entry.tables.length} Tabellen erkannt. Mapping unten prüfen/korrigieren.` });
        } catch (err) {
          setDbStatus({ kind: "err", html: `✗ ${f.name}: ${(err as Error).message} – Fallback/Paste bleibt nutzbar.` });
        }
      }
      setFiles(nextFiles);
      const nextRepos = buildRepos(nextFiles);
      setRepos(nextRepos);
      if (nextRepos.length) toast(`${nextRepos.length} Repos im Register. Klick = Einzelstern, oder „Archiv ausleuchten".`);
      else toast('DB geöffnet, aber keine REPO-Tabelle erkannt – Rolle im Karteikasten auf „REPO-QUELLE" setzen.');
    },
    [files, toast],
  );

  const updateTableRole = useCallback((table: import("@/lib/sqlite/types").IngestedTable, role: import("@/lib/sqlite/types").TableRole) => {
    table.role = role;
    setFiles((prev) => [...prev]);
    setRepos(buildRepos(files));
  }, [files]);

  const updateColumnMapping = useCallback(
    (table: import("@/lib/sqlite/types").IngestedTable, slot: keyof import("@/lib/sqlite/types").ColumnMap, value: string) => {
      (table.map as unknown as Record<string, unknown>)[slot as string] = value || null;
      setFiles((prev) => [...prev]);
      setRepos(buildRepos(files));
    },
    [files],
  );

  const selectSingleRepo = useCallback(
    (rp: RepoRecord) => {
      const readme = readReadme(rp);
      const nextSignals: Signals = { readme, const: "", tree: "", commits: "", conv: "" };
      const nextAssess: Assessment | null =
        rp.classify || rp.rights
          ? { domains: rp.classify?.domains ?? [], role: rp.classify?.role ?? "", prio: rp.classify?.prio ?? "", license: rp.rights?.license ?? "", repo: rp.name }
          : null;
      setSignals(nextSignals);
      setAssess(nextAssess);
      setActiveRepoId(rp.id);
      setMode("single");
      const nextAtoms = extract(nextSignals);
      setAtoms(nextAtoms);
      applyReport(composeFallback({ atoms: nextAtoms, level, mode: "single", metaTotal: 0, dbFileNames, assess: nextAssess }), "fallback");
      setKiStats({ ki: 0, bad: 0 });
    },
    [level, dbFileNames, applyReport],
  );

  const toggleRepoSelection = useCallback((id: string) => {
    setSelectedRepoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const runArchiveIllumination = useCallback(async () => {
    const list = selectedRepoIds.size ? repos.filter((r) => selectedRepoIds.has(r.id)) : repos.filter((r) => r.hasReadme);
    if (!list.length) {
      toast("Keine Repos mit README zum Ausleuchten.");
      return;
    }
    lightAbort.current = false;
    setMode("meta");
    setMetaTotal(list.length);
    setLight({ active: true, current: 0, total: list.length, label: "" });

    const counts: Record<string, number> = {};
    const samples: Record<string, string[]> = {};

    for (let i = 0; i < list.length; i++) {
      if (lightAbort.current) break;
      const rp = list[i];
      const readme = readReadme(rp);
      const found = extract({ readme, const: "", tree: "", commits: "", conv: "" });
      found.forEach((a) => {
        counts[a.id] = (counts[a.id] || 0) + 1;
        samples[a.id] = samples[a.id] || [];
        if (samples[a.id].length < 3) samples[a.id].push(rp.name);
      });
      setLight({ active: true, current: i + 1, total: list.length, label: rp.name.slice(0, 30) });
      if (i % 4 === 0) await wait(0);
    }

    setLight({ active: false, current: 0, total: 0, label: "" });

    if (!Object.keys(counts).length) {
      toast("Keine Befunde im Archiv gefunden.");
      return;
    }
    const metaAtoms = buildMetaAtoms({ counts, samples, total: list.length });
    setAtoms(metaAtoms);
    applyReport(composeFallback({ atoms: metaAtoms, level, mode: "meta", metaTotal: list.length, dbFileNames, assess: null }), "fallback");
    setKiStats({ ki: 0, bad: 0 });
    toast(`Archiv ausgeleuchtet: ${Object.keys(counts).length} Befunde über ${list.length} Repos.`);
  }, [selectedRepoIds, repos, level, dbFileNames, toast, applyReport]);

  const stopIllumination = useCallback(() => {
    lightAbort.current = true;
  }, []);

  const loadDemo = useCallback(() => {
    setManual({ readme: "", const: "", tree: "", commits: "", conv: "" });
    setSignals(SHADED_SIGNALS);
    setAssess(null);
    setMode("single");
    setActiveRepoId(null);
    const nextAtoms = extract(SHADED_SIGNALS);
    setAtoms(nextAtoms);
    applyReport(composeFallback({ atoms: nextAtoms, level, mode: "single", metaTotal: 0, dbFileNames, assess: null }), "fallback");
    setKiStats({ ki: 0, bad: 0 });
  }, [level, dbFileNames, applyReport]);

  const feedManual = useCallback(() => {
    const s: Signals = { readme: manual.readme, const: manual.const, tree: manual.tree, commits: manual.commits, conv: manual.conv };
    const empty = Object.values(s).every((v) => !v.trim());
    if (empty && !activeRepoId) {
      toast("Felder leer und kein Repo aktiv – nichts zu setzen.");
      return;
    }
    let nextSignals = signals;
    if (!empty) {
      nextSignals = s;
      setSignals(s);
      setAssess(null);
      setMode("single");
    }
    const nextAtoms = extract(nextSignals);
    setAtoms(nextAtoms);
    applyReport(composeFallback({ atoms: nextAtoms, level, mode: empty ? mode : "single", metaTotal, dbFileNames, assess: empty ? assess : null }), "fallback");
    setKiStats({ ki: 0, bad: 0 });
  }, [manual, activeRepoId, signals, level, mode, metaTotal, dbFileNames, assess, toast, applyReport]);

  const setLevel = useCallback((l: 1 | 2 | 3 | 4) => {
    setLevelState(l);
  }, []);

  const testConnection = useCallback(async () => {
    if (!cfg.endpoint) {
      setTestResult("Kein Endpoint.");
      return;
    }
    try {
      const ep = cfg.endpoint.replace(/\/+$/, "");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (cfg.key) headers.Authorization = `Bearer ${cfg.key}`;
      const res = await fetch(`${ep}/models`, { headers });
      setTestResult(res.ok ? "✓ Endpoint erreichbar" : `✗ HTTP ${res.status}`);
    } catch (err) {
      setTestResult(`✗ ${(err as Error).message} (lokalen Server/CORS prüfen)`);
    }
  }, [cfg]);

  const filteredSortedRepos = useMemo(() => {
    const q = search.toLowerCase().replace(/[^a-z0-9]/g, "");
    let list = repos.slice();
    if (q) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().replace(/[^a-z0-9]/g, "").includes(q) ||
          r.desc.toLowerCase().replace(/[^a-z0-9]/g, "").includes(q) ||
          (r.classify && r.classify.domains.some((d) => d.toLowerCase().replace(/[^a-z0-9]/g, "").includes(q))),
      );
    }
    if (sort === "stars") list.sort((a, b) => b.stars - a.stars);
    else if (sort === "az") list.sort((a, b) => a.name.localeCompare(b.name));
    else list.sort((a, b) => (b.classify ? 1 : 0) - (a.classify ? 1 : 0) || b.stars - a.stars);
    return list;
  }, [repos, search, sort]);

  return {
    files,
    repos,
    dbStatus,
    handleFiles,
    updateTableRole,
    updateColumnMapping,

    mode,
    setMode,
    search,
    setSearch,
    sort,
    setSort,
    selectedRepoIds,
    toggleRepoSelection,
    activeRepoId,
    selectSingleRepo,
    filteredSortedRepos,

    runArchiveIllumination,
    stopIllumination,
    light,

    signals,
    assess,
    level,
    setLevel,
    atoms,
    metaTotal,

    manual,
    setManual,
    feedManual,
    loadDemo,

    cfg,
    setCfg,
    testConnection,
    testResult,

    report,
    reportMode,
    reportVersion,
    kiLoading,
    kiLiveText,
    kiStats,
    press,

    toastMsg,
    toast,
  };
}

async function readStream(body: ReadableStream<Uint8Array>, onDelta: (text: string) => void): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let full = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const j = JSON.parse(data);
        const delta = j.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          full += delta;
          onDelta(full);
        }
      } catch {
        // ignore malformed SSE chunks
      }
    }
  }
  return full;
}
