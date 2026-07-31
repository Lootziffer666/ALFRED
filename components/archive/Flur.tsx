"use client";

interface Room {
  buch: string;
  rm: string;
  aktiv: boolean;
  quelle: boolean;
  tip: string;
}

/**
 * The "Flur" (hallway) — a row of room doors for ALFRET's other modules.
 * Purely atmospheric worldbuilding, ported from the prototype's SOURCES
 * array: only "Butler" (this tool, Raum VII/VIII) is actually built; the
 * rest are the other modules described in the project's own vision notes
 * (markDown1785242252027.md) — shown here as closed doors with a tooltip,
 * exactly as inert in the original prototype.
 */
const ROOMS: Room[] = [
  { buch: "A", rm: "Vestibül", aktiv: false, quelle: false, tip: "Eingang · Archiv-Status, Zähler." },
  { buch: "O", rm: "Observ.", aktiv: false, quelle: true, tip: "Observatory · I — liefert README + Sterne + URL aus der SQLite-Quelle." },
  { buch: "C", rm: "Karte", aktiv: false, quelle: true, tip: "Cartographer · II — liefert Domänen/Rollen → ASSESSMENT-Beleg an den Bericht." },
  { buch: "S", rm: "Späher", aktiv: false, quelle: true, tip: "Scout · III — Absichts-Vektoren, schärfen die Hypothesen-Schicht." },
  { buch: "C", rm: "Tafel", aktiv: false, quelle: true, tip: "Curator · IV — deine Urteile (Priorität/Stand) → ASSESSMENT, nie Inferenz." },
  { buch: "S", rm: "Siegel", aktiv: false, quelle: true, tip: "Steward · V — Lizenzlage → PERMISSION-Schicht." },
  { buch: "L", rm: "Ledger", aktiv: false, quelle: true, tip: "Ledger · VI — abgeschriebene Belege → EVIDENCE-Schicht." },
  { buch: "B", rm: "Butler", aktiv: true, quelle: false, tip: "Butler · VII — Query-Engine UND CUE-Agent: prüft jeden KI-Satz. Das Siegel." },
];

export function Flur() {
  return (
    <nav className="flur" aria-hidden="true">
      <div className="haus">
        ALFRET · <b>Haus</b>
      </div>
      {ROOMS.map((r, i) => (
        <div key={i} className={`tuer${r.aktiv ? " aktiv" : ""}${r.quelle ? " quelle" : ""}`}>
          <span className="buch">{r.buch}</span>
          <span className="rm">{r.rm}</span>
          <span className="kabel" />
          <div className="tip">
            <b>{r.rm}</b>
            {r.tip}
            {r.quelle && <><br /><span style={{ color: "var(--ok)" }}>liefert → Skriptorium</span></>}
          </div>
        </div>
      ))}
      <span className="spacer" />
      <div className="wachs" title="Raum VII · Butler · Query-Engine / CUE">B</div>
    </nav>
  );
}
