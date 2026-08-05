"use client";

import { ICEBERG_BELOW, ctaFor } from "@/lib/report/capabilities";

/**
 * Sections 14 and 15 of the canonical structure. The report is the visible tip;
 * this states what lies below it, and offers a call to action that leads
 * somewhere real (plan §8.9).
 */
export function IcebergCta() {
  const cta = ctaFor();

  return (
    <section className="card" style={{ marginTop: 30, padding: 20 }} aria-labelledby="iceberg">
      <h2
        id="iceberg"
        className="mono"
        style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--brass)", margin: "0 0 6px" }}
      >
        14. ALFRET-Eisberg
      </h2>

      <p style={{ color: "var(--paper-dim)", margin: "0 0 16px", fontSize: 14, lineHeight: 1.6 }}>
        Dieser Bericht ist ein Nebenprodukt. ALFRET schreibt ihn, weil es das Repository ohnehin
        verstehen muss — nicht umgekehrt. Hier war das ein Aufwärmprogramm: ein öffentliches
        Repository, ein Durchgang, danach vergisst diese Instanz alles wieder. Sie nimmt keine
        Zugangsdaten an und legt nichts an. Zu Hause hört ALFRET an dieser Stelle nicht auf:
      </p>

      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "grid", gap: 10 }}>
        {ICEBERG_BELOW.map((item) => (
          <li key={item.title} style={{ display: "grid", gap: 2 }}>
            <span className="mono" style={{ fontSize: 12, color: "var(--brass-l)" }}>
              {item.title}
              {item.routes.length ? (
                // Die Einträge mit Routen sind die, gegen die ein Besucher hier
                // tatsächlich läuft. Ein stummes 404 wäre eine kaputte Seite;
                // so ist es eine Ansage.
                <span
                  style={{ color: "var(--mut)", marginLeft: 8, fontSize: 10, letterSpacing: ".08em" }}
                  title={`In dieser Demo nicht bedient: ${item.routes.join(", ")}`}
                >
                  · hier nicht bedient
                </span>
              ) : null}
            </span>
            <span style={{ color: "var(--paper-dim)", fontSize: 13.5, lineHeight: 1.5 }}>{item.detail}</span>
          </li>
        ))}
      </ul>

      <h2
        className="mono"
        style={{ fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--brass)", margin: "0 0 8px" }}
      >
        15. CTA
      </h2>

      <p style={{ color: "var(--paper)", margin: "0 0 12px", fontSize: 14.5, lineHeight: 1.6 }}>{cta.headline}</p>

      <a
        className="pill"
        href={cta.href}
        target="_blank"
        rel="noreferrer noopener"
        style={{ display: "inline-flex", gap: 8, alignItems: "center" }}
      >
        <span className="dot" style={{ background: "var(--brass-l)" }} />
        {cta.action}
      </a>

      {!cta.installs ? (
        <p style={{ color: "var(--mut)", fontSize: 12, marginTop: 12, marginBottom: 0, lineHeight: 1.55 }}>
          Es gibt noch keinen fertigen Installer. Dieser Knopf führt zur Beschreibung der lokalen
          Version, nicht zu einer Installation — der Bericht behauptet nichts, was ALFRET nicht hält.
        </p>
      ) : null}
    </section>
  );
}
