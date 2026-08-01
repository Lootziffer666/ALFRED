/**
 * Unit-Tests für Middleware-Hilfsfunktionen (Etappe 12d).
 *
 * Die Edge-Middleware selbst ist schwer direkt in Vitest zu testen
 * (sie braucht die Next.js-Edge-Runtime). Stattdessen testen wir die
 * extrahierbaren reinen Funktionen: Rate-Limit-Logik und Private-IP-Check.
 *
 * Das checkRateLimit und isPrivateOrigin sind hier als Duplikat
 * der Middleware-Logik reimplementiert — einzig damit sie testbar sind.
 * Die kanonische Implementierung bleibt in middleware.ts.
 */

import { describe, it, expect } from "vitest";

// ── Private-IP-Erkennung (reimplementiert für Tests) ─────────────────────────

function isPrivateOrigin(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      /^fd[0-9a-f]{2}:/i.test(hostname)
    );
  } catch {
    return false;
  }
}

describe("isPrivateOrigin", () => {
  it("erkennt localhost als privat", () => {
    expect(isPrivateOrigin("http://localhost:3000")).toBe(true);
  });

  it("erkennt 127.0.0.1 als privat", () => {
    expect(isPrivateOrigin("http://127.0.0.1:7717")).toBe(true);
  });

  it("erkennt 192.168.x.x als privat", () => {
    expect(isPrivateOrigin("http://192.168.1.100:3000")).toBe(true);
  });

  it("erkennt 10.x.x.x als privat", () => {
    expect(isPrivateOrigin("http://10.0.0.1")).toBe(true);
  });

  it("erkennt 172.16.x.x als privat", () => {
    expect(isPrivateOrigin("http://172.16.0.1")).toBe(true);
  });

  it("lässt öffentliche IP durch", () => {
    expect(isPrivateOrigin("https://github.com")).toBe(false);
  });

  it("lässt alfret.dev durch", () => {
    expect(isPrivateOrigin("https://alfret.dev")).toBe(false);
  });

  it("gibt false bei ungültiger URL zurück", () => {
    expect(isPrivateOrigin("nicht-eine-url")).toBe(false);
  });
});

// ── Rate-Limit (reine Logik, reimplementiert) ─────────────────────────────────

interface Entry { count: number; windowStart: number; }

function makeRateLimiter(max: number, windowMs: number) {
  const store = new Map<string, Entry>();
  return {
    check(key: string, now = Date.now()) {
      const entry = store.get(key);
      if (!entry || now - entry.windowStart > windowMs) {
        store.set(key, { count: 1, windowStart: now });
        return { allowed: true, remaining: max - 1 };
      }
      if (entry.count >= max) return { allowed: false, remaining: 0 };
      entry.count += 1;
      return { allowed: true, remaining: max - entry.count };
    },
  };
}

describe("Rate-Limit-Logik", () => {
  it("erlaubt Requests bis zum Limit", () => {
    const rl = makeRateLimiter(3, 60_000);
    expect(rl.check("ip1").allowed).toBe(true);
    expect(rl.check("ip1").allowed).toBe(true);
    expect(rl.check("ip1").allowed).toBe(true);
    expect(rl.check("ip1").allowed).toBe(false);
  });

  it("trennt Limits pro Key", () => {
    const rl = makeRateLimiter(2, 60_000);
    expect(rl.check("ip1").allowed).toBe(true);
    expect(rl.check("ip1").allowed).toBe(true);
    expect(rl.check("ip1").allowed).toBe(false);
    // ip2 hat eigenes Limit
    expect(rl.check("ip2").allowed).toBe(true);
  });

  it("öffnet neues Fenster nach Ablauf", () => {
    const rl = makeRateLimiter(2, 100);
    const t0 = Date.now();
    rl.check("ip1", t0);
    rl.check("ip1", t0);
    // Abgelaufenes Fenster
    expect(rl.check("ip1", t0 + 200).allowed).toBe(true);
  });

  it("liefert korrekten remaining-Wert", () => {
    const rl = makeRateLimiter(5, 60_000);
    expect(rl.check("ip1").remaining).toBe(4);
    expect(rl.check("ip1").remaining).toBe(3);
  });
});
