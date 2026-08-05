"use client";

import { useMemo, useState } from "react";
import "./haus.css";
import { IconColumn } from "./IconColumn";
import { Dock } from "./Dock";
import type { HausRoom } from "./types";

/**
 * Phase 1: der Sechs-Zonen-Rahmen als echtes, anfassbares Gerüst.
 *
 * Bewusst NICHT hier: die fünf bestehenden Seiten (/, /archive, /report,
 * /workshop, /homelab) sind unangetastet. Die Räume unten sind Platzhalter —
 * absichtlich neutral benannt, weil noch offen ist, wie sie sich zur
 * bestehenden Raum-I-bis-IX-Nummerierung verhalten. Diese Seite ist zum
 * Anfassen und Kalibrieren da, nicht zum sofortigen Ersetzen von irgendetwas.
 */

const HEALTH_LAMPS = [
  { id: "daemon", state: "ok" as const },
  { id: "store", state: "ok" as const },
  { id: "github", state: "ok" as const },
  { id: "cue", state: "warn" as const },
  { id: "runner", state: "ok" as const },
];

function useRooms(): HausRoom[] {
  return useMemo<HausRoom[]>(
    () => [
      {
        id: "dokument",
        navLabel: "Platzhalter-Raum · Dokument",
        title: "Platzhalter-Raum · Dokument",
        subtitle: "Zeigt die kontextsensitive Werkzeugzeile — nur hier vorhanden, nicht in jedem Raum.",
        contextToolbar: ["↶", "↷", "𝐁", "𝑰", "≡", "🔗"],
        hasRightbar: true,
        body: (
          <div
            style={{
              background: "#f4f1ea",
              color: "#1a1a1a",
              borderRadius: 8,
              padding: 24,
              maxWidth: 640,
              minHeight: 320,
            }}
          >
            <p style={{ margin: 0, fontWeight: 600 }}>Platzhalter-Dokument</p>
            <p style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6, color: "#444" }}>
              Hier steht später echter Inhalt. Diese Fläche dient nur dazu, Größe und Abstände der
              Zonen zu kalibrieren.
            </p>
          </div>
        ),
      },
      {
        id: "liste",
        navLabel: "Platzhalter-Raum · Liste",
        title: "Platzhalter-Raum · Liste",
        subtitle: "Kein Werkzeugzeile hier — zeigt, dass sie wirklich nur da ist, wo sie passt.",
        hasRightbar: true,
        body: (
          <div style={{ display: "grid", gap: 10, maxWidth: 720 }}>
            {["Eintrag A", "Eintrag B", "Eintrag C"].map((label) => (
              <div
                key={label}
                style={{
                  border: "1px solid var(--haus-border)",
                  borderRadius: 10,
                  padding: 14,
                  background: "var(--haus-surface-raised)",
                }}
              >
                <div style={{ fontSize: 13.5 }}>{label}</div>
                <div style={{ fontSize: 11.5, color: "var(--haus-text-mut)", marginTop: 4 }}>
                  Platzhalter-Beschreibung.
                </div>
              </div>
            ))}
          </div>
        ),
      },
      {
        id: "schmal",
        navLabel: "Platzhalter-Raum · Ohne Mitteilungen",
        title: "Platzhalter-Raum · Ohne Mitteilungen",
        subtitle: "Zeigt, dass die rechte Sidebar pro Raum ganz fehlen kann, nicht nur einklappbar ist.",
        hasRightbar: false,
        body: (
          <p style={{ color: "var(--haus-text-dim)", fontSize: 13 }}>
            Dieser Raum hat gar keine rechte Sidebar — Zone 5 existiert nur dort, wo sie gebraucht wird.
          </p>
        ),
      },
    ],
    [],
  );
}

export function HausShell() {
  const rooms = useRooms();
  const [activeId, setActiveId] = useState(rooms[0].id);
  const [rightbarCollapsed, setRightbarCollapsed] = useState(false);

  const room = rooms.find((r) => r.id === activeId) ?? rooms[0];
  const showRightbar = room.hasRightbar;

  return (
    <div className="haus" data-rightbar={showRightbar && !rightbarCollapsed ? "open" : "collapsed"}>
      {/* Zone 6 — Topbar: immer da, bewegt sich nie. */}
      <header className="haus-topbar">
        <span className="logo">ALFRET</span>
        <div className="haus-search">
          <span aria-hidden>🔍</span>
          <input type="text" placeholder="Suche (Rufsystem folgt später)" />
        </div>
        <div className="haus-topbar-spacer" />
        <button className="haus-profile" title="Profil — Backup/Restore, Sprache (noch nicht gebaut)">
          👤
        </button>
      </header>

      {/* Zone 1 — linke Sidebar: Logo/Update, Navigation, Health. */}
      <aside className="haus-sidebar">
        <div className="haus-sidebar-top">
          <div className="haus-sidebar-version">ALFRET · v0.1.0</div>
          <div className="haus-update-note">
            <span aria-hidden>●</span> Kein Update verfügbar
          </div>
        </div>

        <nav className="haus-sidebar-nav" aria-label="Räume">
          {rooms.map((r, i) => (
            <button
              key={r.id}
              type="button"
              className="haus-nav-item"
              aria-current={r.id === activeId ? "page" : undefined}
              onClick={() => setActiveId(r.id)}
            >
              <span className="n">{i + 1}</span>
              {r.navLabel}
            </button>
          ))}
        </nav>

        <div className="haus-sidebar-health">
          <div className="haus-health-title">Health</div>
          <div className="haus-health-lamps">
            {HEALTH_LAMPS.map((l) => (
              <span key={l.id} className="haus-lamp" data-state={l.state} title={l.id} />
            ))}
          </div>
        </div>
      </aside>

      {/* Zone 2 — Icon-Spalte: direkte Funktionen, per Rechtsklick anpassbar. */}
      <IconColumn />

      {/* Zone 3 — Content / Workbench. */}
      <main className="haus-content">
        <div className="haus-room-header">
          <h1 className="haus-room-title">{room.title}</h1>
          <p className="haus-room-subtitle">{room.subtitle}</p>

          {room.contextToolbar && (
            <div className="haus-context-toolbar">
              {room.contextToolbar.map((sym, i) => (
                <span key={i} aria-hidden>
                  {sym}
                </span>
              ))}
              <span style={{ marginLeft: "auto", color: "var(--haus-text-mut)" }}>
                nur in diesem Raum
              </span>
            </div>
          )}
        </div>

        <div className="haus-room-body">
          {room.body}

          <Dock
            key={room.id}
            items={[
              { id: "explain", label: "Erklär das", icon: "❓" },
              { id: "export", label: "Exportieren", icon: "⇩", primary: true },
            ]}
          />
        </div>
      </main>

      {/* Zone 5 — rechte Sidebar: Mitteilungszentrale, je Raum vorhanden/einklappbar. */}
      {showRightbar && (
        <aside className="haus-rightbar">
          <div className="haus-rightbar-header">
            <span className="haus-rightbar-title">Mitteilungen</span>
            <button
              type="button"
              className="haus-rightbar-toggle"
              onClick={() => setRightbarCollapsed((v) => !v)}
              title={rightbarCollapsed ? "Aufklappen" : "Einklappen"}
            >
              {rightbarCollapsed ? "‹" : "›"}
            </button>
          </div>
          <div className="haus-rightbar-body">
            <div className="haus-notif-card">
              <div className="k">PR #Platzhalter</div>
              <div className="t">Platzhalter-Benachrichtigung mit direktem Link.</div>
              <a href="#">Öffnen →</a>
            </div>
            <div className="haus-notif-card">
              <div className="k">Issue #Platzhalter</div>
              <div className="t">Noch eine Platzhalter-Benachrichtigung.</div>
              <a href="#">Öffnen →</a>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
