"use client";

import { useEffect, useRef, useState } from "react";
import type { IconAction } from "./types";

/**
 * Zone 2 — reine Icons, keine Beschriftung im UI. Hover zeigt sofort den
 * Funktionsnamen (natives `title`, kein Klick auf ein "?" nötig). Rechtsklick
 * öffnet "Icon wählen" / "Funktion zuweisen" und zeigt dabei auch die aktuelle
 * Bindung, ohne die Funktion auszulösen.
 *
 * Icons und Funktionsliste sind für diesen ersten Durchgang plausible
 * Platzhalter — austauschbar, sobald passendere gefunden sind. Die Bindung
 * lebt nur im Component-State: Speichern in ein benanntes, exportierbares
 * Profil ist Teil von Phase 2, nicht hiervon.
 */

const ICON_CHOICES = ["⬢", "🧩", "📎", "🔍", "🛰️", "🧬", "🗂️", "⚙️", "🩺", "🧵", "🔗", "🧭"];

const FUNCTION_CHOICES: IconAction[] = [
  { id: "add-repo-to-context", label: "Repo zum Kontext hinzufügen", icon: "🧩" },
  { id: "check-skill-db", label: "Skill-DB prüfen", icon: "🗂️" },
  { id: "health-check", label: "Healthcheck ausführen", icon: "🩺" },
  { id: "reload-context", label: "Kontext neu laden", icon: "🔄" },
  { id: "open-search", label: "Suche öffnen", icon: "🔍" },
  { id: "unassigned", label: "Nicht zugewiesen", icon: "⬢" },
];

interface SlotBinding {
  functionId: string;
  icon: string;
}

const DEFAULT_SLOTS: SlotBinding[] = [
  { functionId: "add-repo-to-context", icon: "🧩" },
  { functionId: "check-skill-db", icon: "🗂️" },
  { functionId: "health-check", icon: "🩺" },
  { functionId: "unassigned", icon: "⬢" },
];

function labelFor(functionId: string): string {
  return FUNCTION_CHOICES.find((f) => f.id === functionId)?.label ?? "Nicht zugewiesen";
}

export function IconColumn() {
  const [slots, setSlots] = useState<SlotBinding[]>(DEFAULT_SLOTS);
  const [menu, setMenu] = useState<{ slot: number; x: number; y: number; mode: "root" | "icon" | "fn" } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(null);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [menu]);

  function openMenu(e: React.MouseEvent, slot: number) {
    e.preventDefault();
    setMenu({ slot, x: e.clientX, y: e.clientY, mode: "root" });
  }

  function pickIcon(icon: string) {
    if (!menu) return;
    setSlots((prev) => prev.map((s, i) => (i === menu.slot ? { ...s, icon } : s)));
    setMenu(null);
  }

  function pickFunction(functionId: string) {
    if (!menu) return;
    const fn = FUNCTION_CHOICES.find((f) => f.id === functionId);
    setSlots((prev) =>
      prev.map((s, i) => (i === menu.slot ? { functionId, icon: fn?.icon ?? s.icon } : s)),
    );
    setMenu(null);
  }

  return (
    <nav className="haus-iconcol" aria-label="Direkte Funktionen">
      <div className="haus-iconcol-actions">
        {slots.map((slot, i) => (
          <button
            key={i}
            type="button"
            className="haus-icon-btn"
            title={labelFor(slot.functionId)}
            onContextMenu={(e) => openMenu(e, i)}
          >
            <span aria-hidden>{slot.icon}</span>
          </button>
        ))}
      </div>

      <div className="haus-iconcol-divider" />

      {/* Reserviert für spätere Makros — noch keine Funktion dahinter. */}
      <div className="haus-iconcol-macros" aria-label="Platz für Makros (später)">
        <div className="haus-macro-slot" title="Makro-Platz (noch nicht belegt)">
          +
        </div>
      </div>

      {menu && (
        <div
          ref={menuRef}
          className="haus-ctxmenu"
          style={{ left: menu.x, top: menu.y }}
          role="menu"
        >
          {menu.mode === "root" && (
            <>
              <div className="haus-ctxmenu-current">
                Aktuell: {labelFor(slots[menu.slot].functionId)}
              </div>
              <button
                type="button"
                className="haus-ctxmenu-item"
                onClick={() => setMenu({ ...menu, mode: "icon" })}
              >
                🎨 Icon wählen
              </button>
              <button
                type="button"
                className="haus-ctxmenu-item"
                onClick={() => setMenu({ ...menu, mode: "fn" })}
              >
                ⚙️ Funktion zuweisen
              </button>
            </>
          )}

          {menu.mode === "icon" && (
            <>
              <div className="haus-ctxmenu-label">Icon wählen</div>
              <div className="haus-ctxmenu-sub">
                {ICON_CHOICES.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    data-active={slots[menu.slot].icon === icon}
                    onClick={() => pickIcon(icon)}
                    aria-label={`Icon ${icon} verwenden`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </>
          )}

          {menu.mode === "fn" && (
            <>
              <div className="haus-ctxmenu-label">Funktion zuweisen</div>
              {FUNCTION_CHOICES.map((fn) => (
                <button
                  key={fn.id}
                  type="button"
                  className="haus-ctxmenu-item"
                  onClick={() => pickFunction(fn.id)}
                >
                  <span aria-hidden>{fn.icon}</span> {fn.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </nav>
  );
}
