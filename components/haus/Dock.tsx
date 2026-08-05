"use client";

import { useRef, useState } from "react";
import type { DockCorner, DockItem } from "./types";

/**
 * Das frei verschiebbare Shortcut-Dock.
 *
 * Bewusste Vereinfachungen für diesen ersten Durchgang, damit sie nicht
 * unbemerkt bleiben:
 * - Es schnappt an eine von vier ECKEN des Content-Bereichs, nicht an eine
 *   beliebige Stelle entlang einer Kante. Eine hochkant-Ausrichtung an
 *   Seitenkanten kommt, sobald klar ist, ab welcher Position das greifen soll.
 * - Es liegt als Kind von .haus-room-body im DOM — das ist der eigentliche
 *   Trick, nicht Mathematik: dadurch kann es strukturell gar nicht über die
 *   linke Sidebar, die Icon-Spalte, die Topbar oder den Raum-Kopf geraten,
 *   und rückt automatisch mit, wenn die rechte Sidebar auf- oder zuklappt,
 *   weil sich dann nur die Breite der content-Spalte ändert — kein JS nötig.
 *
 * Der Aufrufer gibt beim Rendern `key={raumId}` mit — dadurch baut React die
 * Komponente bei jedem Raumwechsel komplett neu auf und `corner` startet
 * garantiert wieder bei "br", statt sich per Effekt zurückzusetzen.
 */
export function Dock({ items }: { items: DockItem[] }) {
  const [corner, setCorner] = useState<DockCorner>("br");
  const dragging = useRef(false);
  const dockRef = useRef<HTMLDivElement>(null);

  function onPointerDown(e: React.PointerEvent) {
    // Nur der Griff startet das Ziehen — ein Klick auf einen Eintrag soll
    // die Funktion auslösen, nicht das Dock bewegen.
    if (!(e.target as HTMLElement).closest("[data-dock-handle]")) return;
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const bounds = dockRef.current?.offsetParent as HTMLElement | null;
    if (!bounds) return;
    const rect = bounds.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    const next: DockCorner = `${relY < 0.5 ? "t" : "b"}${relX < 0.5 ? "l" : "r"}` as DockCorner;
    if (next !== corner) setCorner(next);
  }

  function onPointerUp() {
    dragging.current = false;
  }

  return (
    <div
      ref={dockRef}
      className="haus-dock"
      data-corner={corner}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        className="haus-dock-handle"
        data-dock-handle
        onPointerDown={onPointerDown}
        title="Ziehen zum Verschieben — landet an der nächsten Ecke"
        aria-label="Dock verschieben"
      >
        ⠿
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`haus-dock-item${item.primary ? " primary" : ""}`}
          onClick={item.onSelect}
          title={item.label}
        >
          <span aria-hidden>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}
