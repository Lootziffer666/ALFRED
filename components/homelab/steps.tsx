"use client";

import { useState } from "react";
import { AvailabilityBadge } from "@/components/AvailabilityBadge";
import type { useHomelab } from "./useHomelab";
import type { ManualNodeInput } from "./useHomelab";
import type { HardwareReconciliation, NodeDeclaration, TaskProfileId } from "@/lib/schema/homelab";
import { isFixtureNode, isUserAuthored } from "@/lib/homelab/discovery";
import { rankModels } from "@/lib/homelab/models";
import { planToJson, planToMarkdown } from "@/lib/homelab/export";

type Homelab = ReturnType<typeof useHomelab>;

const label = { fontSize: 11, color: "var(--paper-dim)" } as const;
const heading = {
  fontSize: 11,
  letterSpacing: ".16em",
  textTransform: "uppercase",
  color: "var(--brass)",
  margin: "0 0 10px",
} as const;

const TRUTH_COLOR: Record<HardwareReconciliation["truth"], string> = {
  verified: "var(--ok)",
  observed: "var(--brass-l)",
  contradicted: "var(--zinnober)",
  not_proven: "var(--hyp)",
  declared: "var(--hyp)",
  stale: "var(--hyp)",
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card" style={{ padding: 16 }}>
      <h2 className="mono" style={heading}>{title}</h2>
      {children}
    </section>
  );
}

function NodeBadge({ node }: { node: NodeDeclaration }) {
  return (
    <span className="pill">
      <span className="dot" style={{ background: isFixtureNode(node) ? "var(--hyp)" : "var(--brass-l)" }} />
      {node.discovery.source}
    </span>
  );
}

// ── 1 · Geräte finden ───────────────────────────────────────────────────────

export function DevicesStep({ h }: { h: Homelab }) {
  const [form, setForm] = useState<ManualNodeInput>({
    name: "",
    kind: "workstation",
    os: "linux",
    trust: "owned",
    availability: "always",
  });
  const [address, setAddress] = useState("");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card title="Gefundene und beschriebene Geräte">
        <p style={{ color: "var(--paper-dim)", fontSize: 13.5, lineHeight: 1.6, margin: "0 0 12px" }}>
          ALFRET sucht keine Adressbereiche ab. Geräte melden sich selbst, oder du beschreibst sie.
          Ein gemeldeter Runner wird erst nach Pairing zu einem Node — das kommt mit dem Runner.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={h.loadFixtures}>Demo-Geräte laden</button>
        </div>

        {h.nodes.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "grid", gap: 8 }}>
            {h.nodes.map(({ declaration, observation }) => (
              <li key={declaration.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span className="mono" style={{ fontSize: 13, color: "var(--paper)" }}>{declaration.name}</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--mut)" }}>
                  {declaration.kind} · {declaration.os} · {declaration.trust} · {declaration.availability}
                </span>
                <NodeBadge node={declaration} />
                <AvailabilityBadge status={observation ? "loaded" : "skipped"} />
                <button type="button" className="ghost" onClick={() => h.removeNode(declaration.id)}>
                  entfernen
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: "var(--mut)", fontSize: 13, fontStyle: "italic", margin: "14px 0 0" }}>
            Noch keine Geräte.
          </p>
        )}
      </Card>

      <Card title="Gerät selbst beschreiben">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim()) return;
            h.addManualNode(form);
            setForm({ ...form, name: "", cpu: undefined, ramGb: undefined, vramGb: undefined });
          }}
          style={{ display: "grid", gap: 10 }}
        >
          <label style={{ display: "grid", gap: 4 }}>
            <span className="mono" style={label}>Name</span>
            <input type="text" aria-label="Gerätename" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>

          <div className="grid2" style={{ gap: 10 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="mono" style={label}>Art</span>
              <select aria-label="Geräteart" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ManualNodeInput["kind"] })}>
                {["workstation", "laptop", "nas", "phone", "borrowed", "rented"].map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="mono" style={label}>Betriebssystem</span>
              <select aria-label="Betriebssystem" value={form.os} onChange={(e) => setForm({ ...form, os: e.target.value as ManualNodeInput["os"] })}>
                {["windows", "linux", "macos", "android"].map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="mono" style={label}>Vertrauen</span>
              <select aria-label="Vertrauen" value={form.trust} onChange={(e) => setForm({ ...form, trust: e.target.value as ManualNodeInput["trust"] })}>
                {["owned", "borrowed", "rented"].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="mono" style={label}>Verfügbarkeit</span>
              <select aria-label="Verfügbarkeit" value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value as ManualNodeInput["availability"] })}>
                {["always", "intermittent", "on-demand"].map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </label>
          </div>

          <p className="mono" style={{ fontSize: 11, color: "var(--mut)", margin: 0, lineHeight: 1.5 }}>
            Hardware ist optional — was ein Runner messen kann, musst du nicht eintippen.
          </p>
          <div className="grid2" style={{ gap: 10 }}>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="mono" style={label}>RAM (GB, behauptet)</span>
              <input type="text" aria-label="RAM in GB" value={form.ramGb ?? ""} onChange={(e) => setForm({ ...form, ramGb: Number(e.target.value) || undefined })} />
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span className="mono" style={label}>VRAM (GB, behauptet)</span>
              <input type="text" aria-label="VRAM in GB" value={form.vramGb ?? ""} onChange={(e) => setForm({ ...form, vramGb: Number(e.target.value) || undefined })} />
            </label>
          </div>
          <button type="submit" style={{ justifySelf: "start" }}>Gerät hinzufügen</button>
        </form>
      </Card>

      <Card title="Runner-Adresse vormerken">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!address.trim()) return;
            h.rememberRunnerAddress(address.trim());
            setAddress("");
          }}
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <input type="text" aria-label="Runner-Adresse" placeholder="alfret-runner.local:7717" value={address} onChange={(e) => setAddress(e.target.value)} />
          <button type="submit">Vormerken</button>
        </form>
        {h.pending.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", display: "grid", gap: 6 }}>
            {h.pending.map((p) => (
              <li key={p.discovery.discoveredId} style={{ fontSize: 13, color: "var(--paper-dim)" }}>
                <span className="mono">{p.discovery.address}</span> — {p.blocked}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
    </div>
  );
}

// ── 2 · Hardware prüfen ─────────────────────────────────────────────────────

export function HardwareStep({ h }: { h: Homelab }) {
  const [raw, setRaw] = useState("");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {h.reconciliation.map(({ node, rows }) => (
        <Card key={node.id} title={`${node.name} — behauptet gegen gemessen`}>
          {isUserAuthored(node) ? (
            <p className="mono" style={{ fontSize: 11, color: "var(--hyp)", margin: "0 0 10px" }}>
              ⚠ Selbst beschrieben, nicht gemessen. Alles hier bleibt unbelegt, bis ein Runner probt.
            </p>
          ) : null}
          <div className="scroll-x">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr className="mono" style={{ color: "var(--mut)", fontSize: 11, textAlign: "left" }}>
                  <th style={{ padding: "4px 8px 4px 0" }}>Feld</th>
                  <th style={{ padding: "4px 8px" }}>Behauptet</th>
                  <th style={{ padding: "4px 8px" }}>Gemessen</th>
                  <th style={{ padding: "4px 8px" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.field} style={{ borderTop: "1px solid var(--line)" }}>
                    <td className="mono" style={{ padding: "6px 8px 6px 0", color: "var(--paper-dim)" }}>{row.field}</td>
                    <td style={{ padding: "6px 8px", color: "var(--paper)" }}>{row.declared ?? "—"}</td>
                    <td style={{ padding: "6px 8px", color: "var(--paper)" }}>{row.observed ?? "—"}</td>
                    <td style={{ padding: "6px 8px" }}>
                      <span className="pill">
                        <span className="dot" style={{ background: TRUTH_COLOR[row.truth] }} />
                        {row.truth}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.some((r) => r.truth === "contradicted") ? (
            <p style={{ color: "var(--zinnober)", fontSize: 12.5, margin: "10px 0 0", lineHeight: 1.5 }}>
              Behauptung und Messung gehen auseinander. ALFRET überschreibt die Angabe nicht — das entscheidest du.
            </p>
          ) : null}
        </Card>
      ))}

      <Card title="Beobachtung eines Runners einspielen">
        <p style={{ color: "var(--paper-dim)", fontSize: 13, lineHeight: 1.6, margin: "0 0 10px" }}>
          Bis der Runner existiert, kannst du eine Probe als JSON einsetzen. Sie wird gegen das
          NodeObservation-Schema geprüft, bevor ihr geglaubt wird.
        </p>
        <textarea
          aria-label="NodeObservation JSON"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={5}
          style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: 12 }}
        />
        <button type="button" style={{ marginTop: 8 }} onClick={() => { if (h.importObservation(raw)) setRaw(""); }}>
          Beobachtung übernehmen
        </button>
      </Card>
    </div>
  );
}

// ── 3 · Nutzungsregeln ──────────────────────────────────────────────────────

export function PoliciesStep({ h }: { h: Homelab }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p style={{ color: "var(--paper-dim)", fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
        Das hier kann kein Runner messen: wem das Gerät gehört, was es verarbeiten darf und wann es
        stillstehen soll. Genau deshalb pflegst du es von Hand.
      </p>
      {h.nodes.map(({ declaration }) => {
        const p = declaration.policy;
        const set = (patch: Partial<typeof p>) => h.setPolicy(declaration.id, { ...p, ...patch });
        return (
          <Card key={declaration.id} title={declaration.name}>
            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--paper)" }}>
                <input type="checkbox" checked={p.automaticUse} onChange={(e) => set({ automaticUse: e.target.checked })} />
                Darf ohne Rückfrage genutzt werden
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--paper)" }}>
                <input type="checkbox" checked={p.mayInstall} onChange={(e) => set({ mayInstall: e.target.checked })} />
                Darf Runtimes und Modelle installieren
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "var(--paper)" }}>
                <input type="checkbox" checked={p.computeWhileUserActive} onChange={(e) => set({ computeWhileUserActive: e.target.checked })} />
                Darf rechnen, während jemand daran arbeitet
              </label>
              <label style={{ display: "grid", gap: 4, maxWidth: 260 }}>
                <span className="mono" style={label}>Höchste Datenklasse</span>
                <select
                  aria-label={`Datenklasse ${declaration.name}`}
                  value={p.maxDataClass}
                  onChange={(e) => set({ maxDataClass: e.target.value as typeof p.maxDataClass })}
                >
                  {["public", "private", "secret"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "grid", gap: 4, maxWidth: 260 }}>
                <span className="mono" style={label}>Ruhezeiten (z.B. 23:00-07:00)</span>
                <input
                  type="text"
                  aria-label={`Ruhezeiten ${declaration.name}`}
                  value={p.quietHours.join(", ")}
                  onChange={(e) => set({ quietHours: e.target.value.split(",").map((v) => v.trim()).filter(Boolean) })}
                />
              </label>
              {declaration.trust !== "owned" ? (
                <p className="mono" style={{ fontSize: 11, color: "var(--zinnober)", margin: 0, lineHeight: 1.5 }}>
                  ⚠ {declaration.trust}: private und geheime Aufgaben kommen hier grundsätzlich nicht hin,
                  unabhängig von dieser Einstellung.
                </p>
              ) : null}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ── 4 · Bedarf ──────────────────────────────────────────────────────────────

export function NeedsStep({ h }: { h: Homelab }) {
  const [raw, setRaw] = useState("");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card title="Projektkorpus einlesen">
        <p style={{ color: "var(--paper-dim)", fontSize: 13, lineHeight: 1.6, margin: "0 0 10px" }}>
          Ein Korpus-Export aus Etappe 2. Nur der Projektbestand erzeugt verbindlichen Bedarf —
          Donor und externe Funde liefern höchstens Vorschläge.
        </p>
        <textarea
          aria-label="Korpus JSON"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={4}
          style={{ width: "100%", fontFamily: "var(--font-mono)", fontSize: 12 }}
        />
        <button type="button" style={{ marginTop: 8 }} onClick={() => { if (h.importProjectCorpus(raw)) setRaw(""); }}>
          Korpus lesen
        </button>

        {h.needs.length > 0 ? (
          <ul style={{ listStyle: "none", padding: 0, margin: "14px 0 0", display: "grid", gap: 6 }}>
            {h.needs.map((n) => (
              <li key={n.id} style={{ fontSize: 13, color: "var(--paper-dim)", lineHeight: 1.5 }}>
                <span className="mono" style={{ color: "var(--paper)" }}>{n.capabilityId}</span> — {n.reason}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <Card title="Aufgaben auswählen">
        <p style={{ color: "var(--paper-dim)", fontSize: 13, lineHeight: 1.6, margin: "0 0 10px" }}>
          Der Bedarf sagt, was offen ist. Welche Aufgabenklassen ALFRET dafür planen soll, entscheidest du.
        </p>
        <div style={{ display: "grid", gap: 6 }}>
          {h.allTasks.map((t) => (
            <label key={t.id} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 13, color: "var(--paper)" }}>
              <input
                type="checkbox"
                aria-label={t.id}
                checked={h.tasks.includes(t.id as TaskProfileId)}
                onChange={() => h.toggleTask(t.id as TaskProfileId)}
              />
              <span className="mono" style={{ fontSize: 12 }}>{t.id}</span>
              <span style={{ color: "var(--mut)", fontSize: 12 }}>
                {t.dataClass} · {t.contextTokens} Token{t.alwaysOn ? " · dauerhaft" : ""}{t.exclusive ? " · exklusiv" : ""}
              </span>
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ── 5 · Modelle ─────────────────────────────────────────────────────────────

export function ModelsStep({ h }: { h: Homelab }) {
  const [query, setQuery] = useState("");
  const measured = h.nodes.find((n) => n.observation);
  const task = h.tasks[0] ? h.allTasks.find((t) => t.id === h.tasks[0])! : h.allTasks[0];
  const availableGb = measured?.observation?.gpus.reduce((max, g) => Math.max(max, g.vramGb), 0) ?? 0;

  const ranked = availableGb
    ? rankModels(h.models, {
        task,
        runtime: "ollama",
        target: "gpu",
        availableGb,
        drivesDisplay: measured?.observation?.gpus.some((g) => g.drivesDisplay),
        records: h.records,
      })
    : [];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card title="Katalog durchsuchen">
        <form
          onSubmit={(e) => { e.preventDefault(); if (query.trim()) void h.searchModels(query.trim()); }}
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <input type="text" aria-label="Modellsuche" placeholder="z.B. qwen2.5-coder 7b" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button type="submit" disabled={h.searching}>{h.searching ? "Sucht…" : "Auf Hugging Face suchen"}</button>
        </form>
        <p className="mono" style={{ fontSize: 11, color: "var(--mut)", margin: "10px 0 0", lineHeight: 1.5 }}>
          {h.models.length} Kandidaten im Katalog. Größen, Parameterzahl und Lizenz stammen aus dem
          Repository, nicht aus einer Schätzung.
        </p>
      </Card>

      <Card title={`Eignung für ${task.id}`}>
        {availableGb === 0 ? (
          <p style={{ color: "var(--hyp)", fontSize: 13, margin: 0, lineHeight: 1.6 }}>
            Kein Gerät hat eine gemessene GPU. Ohne Messung lässt sich kein Fit behaupten — spiel in
            Schritt 2 eine Beobachtung ein.
          </p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
            {ranked.slice(0, 12).map((r) => (
              <li key={r.candidate.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span className="mono" style={{ fontSize: 12.5, color: "var(--paper)" }}>
                    {r.candidate.repository} {r.candidate.quantization ?? ""}
                  </span>
                  <span className="pill">
                    <span className="dot" style={{ background: r.fit === "fits" ? "var(--ok)" : r.fit === "tight" ? "var(--brass-l)" : "var(--zinnober)" }} />
                    {r.fit}
                  </span>
                  <span className="pill">
                    <span className="dot" style={{ background: r.suitability === "proven" ? "var(--ok)" : "var(--hyp)" }} />
                    {r.suitability}
                  </span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--mut)" }}>
                    {r.memory.expectedGb} GB erwartet / {availableGb} GB · {r.memory.confidence}
                  </span>
                </div>
                {r.blockers.map((b) => (
                  <div key={b} style={{ color: "var(--zinnober)", fontSize: 12, lineHeight: 1.5 }}>⊘ {b}</div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ── 6 · Plan ────────────────────────────────────────────────────────────────

export function PlanStep({ h }: { h: Homelab }) {
  const { proposals, unplaced } = h.planning;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {h.tasks.length === 0 ? (
        <p style={{ color: "var(--mut)", fontSize: 13, fontStyle: "italic" }}>
          Noch keine Aufgabe gewählt — in Schritt 4 auswählen.
        </p>
      ) : null}

      {proposals.map((p) => (
        <Card key={`${p.task}-${p.nodeId}`} title={`${p.task} → ${p.nodeId}`}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <span className="pill">
              <span className="dot" style={{ background: p.fit === "fits" ? "var(--ok)" : p.fit === "not-proven" ? "var(--hyp)" : "var(--brass-l)" }} />
              {p.fit}
            </span>
            <span className="mono" style={{ fontSize: 11, color: "var(--mut)" }}>
              {p.runtime} / {p.delivery} · {p.residency} · Modell {p.modelId ?? "—"}
            </span>
          </div>

          {p.memory ? (
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 10px", display: "grid", gap: 2 }}>
              {p.memory.breakdown.map((b) => (
                <li key={b.label} className="mono" style={{ fontSize: 11.5, color: "var(--paper-dim)" }}>
                  {b.label}: {b.gb} GB
                </li>
              ))}
              <li className="mono" style={{ fontSize: 11.5, color: "var(--paper)" }}>
                min {p.memory.minimumGb} / erwartet {p.memory.expectedGb} / max {p.memory.maximumGb} GB ({p.memory.confidence})
              </li>
            </ul>
          ) : null}

          {p.rationale.map((r) => (
            <div key={r} style={{ color: "var(--paper-dim)", fontSize: 13, lineHeight: 1.5 }}>· {r}</div>
          ))}
          {p.warnings.map((w) => (
            <div key={w} style={{ color: "var(--hyp)", fontSize: 12.5, lineHeight: 1.5 }}>⚠ {w}</div>
          ))}
          {p.fallbackNodeIds.length ? (
            <div className="mono" style={{ fontSize: 11, color: "var(--mut)", marginTop: 8 }}>
              Fallback: {p.fallbackNodeIds.join(" → ")}
            </div>
          ) : null}
        </Card>
      ))}

      {unplaced.map((u) => (
        <Card key={u.task} title={`${u.task} — nicht platziert`}>
          {u.reasons.map((r) => (
            <div key={r} style={{ color: "var(--zinnober)", fontSize: 13, lineHeight: 1.55 }}>⊘ {r}</div>
          ))}
        </Card>
      ))}
    </div>
  );
}

// ── 7 · Export ──────────────────────────────────────────────────────────────

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportStep({ h }: { h: Homelab }) {
  const input = { nodes: h.nodes, planning: h.planning };

  return (
    <Card title="Plan ausgeben">
      <p style={{ color: "var(--paper-dim)", fontSize: 13.5, lineHeight: 1.6, margin: "0 0 12px" }}>
        Der Export enthält Geräte, den Vergleich behauptet gegen gemessen, die Platzierungen mit
        ihrer Speicheraufschlüsselung und alles, was nicht platziert werden konnte. Ausgeführt wurde
        nichts davon.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" onClick={() => download("alfret-raum-ix-plan.md", planToMarkdown(input), "text/markdown")}>
          ⧉ Markdown
        </button>
        <button type="button" onClick={() => download("alfret-raum-ix-plan.json", planToJson(input), "application/json")}>
          ⧉ JSON
        </button>
      </div>
    </Card>
  );
}
