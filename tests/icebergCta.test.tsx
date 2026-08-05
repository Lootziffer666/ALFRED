// Der Eisberg-Abschnitt ist die Stelle, an der die Demo zugibt, dass sie ein
// Aufwärmprogramm ist. Wenn er nicht rendert, wirkt die Demo wie ein weiteres
// "paste dein Repo" — genau der Eindruck, den sie vermeiden soll.
//
// Geprüft wird die Komponente, nicht die Seite: der Bericht wird clientseitig
// geladen, ein HTML-Abruf der Route zeigt den Abschnitt deshalb gar nicht.

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IcebergCta } from "@/components/report/IcebergCta";
import { ICEBERG_BELOW, ctaFor } from "@/lib/report/capabilities";

describe("IcebergCta", () => {
  it("rahmt den Bericht als Aufwärmprogramm — im Intro wie im CTA", () => {
    render(<IcebergCta />);
    expect(screen.getAllByText(/Aufwärmprogramm/).length).toBeGreaterThanOrEqual(2);
  });

  it("sagt, dass diese Instanz nichts annimmt und nichts behält", () => {
    render(<IcebergCta />);
    const intro = screen.getByText(/Dieser Bericht ist ein Nebenprodukt/).textContent ?? "";
    expect(intro).toMatch(/keine Zugangsdaten/);
    expect(intro).toMatch(/vergisst|legt nichts an/);
  });

  it("zeigt jeden Eisberg-Eintrag mit Titel und Erklärung", () => {
    render(<IcebergCta />);
    for (const item of ICEBERG_BELOW) {
      expect(screen.getByText(item.title, { exact: false })).toBeInTheDocument();
      expect(screen.getByText(item.detail)).toBeInTheDocument();
    }
  });

  it("markiert genau die Einträge, gegen die ein Besucher hier läuft", () => {
    render(<IcebergCta />);
    const withRoutes = ICEBERG_BELOW.filter((i) => i.routes.length).length;
    expect(screen.getAllByText(/hier nicht bedient/)).toHaveLength(withRoutes);
  });

  it("führt zu etwas Echtem und verspricht keine Installation, die es nicht gibt", () => {
    render(<IcebergCta />);
    const cta = ctaFor();
    const link = screen.getByRole("link", { name: new RegExp(cta.action, "i") });
    expect(link).toHaveAttribute("href", cta.href);
    if (!cta.installs) {
      expect(screen.getByText(/noch keinen fertigen Installer/)).toBeInTheDocument();
    }
  });
});
