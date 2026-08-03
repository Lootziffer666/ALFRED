/**
 * Tests für die reine Logik des Edge-Proxy (Etappe 12d).
 *
 * Diese Datei hieß tests/middleware.test.ts und hatte beide Funktionen
 * NACHGEBAUT — mit dem ausdrücklichen Hinweis, die kanonische Fassung bleibe in
 * middleware.ts. Damit prüfte sie die Kopie und nicht den ausgelieferten Code:
 * jede Abweichung zwischen beiden wäre unbemerkt geblieben, und der Test wäre
 * grün geblieben, während der Proxy falsch entscheidet.
 *
 * Die Logik liegt jetzt in lib/proxy/limits.ts, das der Proxy importiert und
 * dieser Test prüft. Der Proxy selbst (proxy.ts) bleibt untestbar ohne
 * Edge-Runtime — er enthält aber nur noch Verdrahtung.
 */

import { describe, it, expect } from "vitest";
import {
  checkRateLimit,
  isPrivateOrigin,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  type RateLimitEntry,
} from "@/lib/proxy/limits";

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

  // URL.hostname liefert IPv6-Literale IMMER in eckigen Klammern. Die frühere
  // Fassung verglich gegen die ungeklammerte Form — jede IPv6-Adresse, auch
  // ::1, kam damit als "öffentlich" durch.
  it("erkennt IPv6-ULA als privat, trotz eckiger Klammern", () => {
    expect(isPrivateOrigin("http://[fd00::1]")).toBe(true);
    expect(isPrivateOrigin("http://[fc00::1]:7717")).toBe(true);
  });

  it("erkennt IPv6-Loopback als privat", () => {
    expect(isPrivateOrigin("http://[::1]:3000")).toBe(true);
  });

  it("erkennt IPv6-Link-local als privat", () => {
    expect(isPrivateOrigin("http://[fe80::1]")).toBe(true);
  });

  it("erkennt die Cloud-Metadaten-Adresse als privat", () => {
    expect(isPrivateOrigin("http://169.254.169.254")).toBe(true);
  });

  it("lässt öffentliche IPv6 durch", () => {
    expect(isPrivateOrigin("http://[2606:4700:4700::1111]")).toBe(false);
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

describe("checkRateLimit", () => {
  const store = () => new Map<string, RateLimitEntry>();

  it("erlaubt Requests bis zum Limit", () => {
    const s = store();
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      expect(checkRateLimit(s, "ip1").allowed).toBe(true);
    }
    expect(checkRateLimit(s, "ip1").allowed).toBe(false);
  });

  it("trennt Limits pro Key", () => {
    const s = store();
    for (let i = 0; i < RATE_LIMIT_MAX; i++) checkRateLimit(s, "ip1");
    expect(checkRateLimit(s, "ip1").allowed).toBe(false);
    expect(checkRateLimit(s, "ip2").allowed).toBe(true);
  });

  it("öffnet neues Fenster nach Ablauf", () => {
    const s = store();
    const t0 = Date.now();
    for (let i = 0; i < RATE_LIMIT_MAX; i++) checkRateLimit(s, "ip1", t0);
    expect(checkRateLimit(s, "ip1", t0).allowed).toBe(false);
    expect(checkRateLimit(s, "ip1", t0 + RATE_LIMIT_WINDOW_MS + 1).allowed).toBe(true);
  });

  it("liefert korrekten remaining-Wert", () => {
    const s = store();
    expect(checkRateLimit(s, "ip1").remaining).toBe(RATE_LIMIT_MAX - 1);
    expect(checkRateLimit(s, "ip1").remaining).toBe(RATE_LIMIT_MAX - 2);
  });

  // Der Store wuchs vorher unbegrenzt: jede je gesehene IP blieb für immer
  // liegen — auf einem öffentlichen Endpunkt ein Speicherleck mit Fremdsteuerung.
  it("räumt abgelaufene Fenster weg, statt jede je gesehene IP zu behalten", () => {
    const s = store();
    const t0 = Date.now();
    for (let i = 0; i < 500; i++) checkRateLimit(s, `ip-${i}`, t0);
    expect(s.size).toBe(500);

    checkRateLimit(s, "später", t0 + RATE_LIMIT_WINDOW_MS + 1);
    expect(s.size).toBe(1);
  });
});
