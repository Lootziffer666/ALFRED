import { describe, it, expect, afterEach } from "vitest";
import { readFlag, isFlagEnabled, resolveCtaVariant, getCtaContent } from "@/lib/flags";

describe("Feature-Flags", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    // Env zurücksetzen
    Object.keys(process.env).forEach((k) => {
      if (k.startsWith("ALFRET_FLAG_")) delete process.env[k];
    });
    Object.assign(process.env, originalEnv);
  });

  it("gibt not-set zurück wenn Flag nicht gesetzt", () => {
    delete process.env["ALFRET_FLAG_LOCAL_INSTALLER_READY"];
    expect(readFlag("local-installer-ready")).toBe("not-set");
  });

  it("erkennt Flag als enabled bei Wert '1'", () => {
    process.env["ALFRET_FLAG_LOCAL_INSTALLER_READY"] = "1";
    expect(readFlag("local-installer-ready")).toBe("enabled");
    expect(isFlagEnabled("local-installer-ready")).toBe(true);
  });

  it("erkennt Flag als enabled bei Wert 'true'", () => {
    process.env["ALFRET_FLAG_LOCAL_INSTALLER_READY"] = "true";
    expect(isFlagEnabled("local-installer-ready")).toBe(true);
  });

  it("erkennt Flag als disabled bei Wert '0'", () => {
    process.env["ALFRET_FLAG_LOCAL_INSTALLER_READY"] = "0";
    expect(readFlag("local-installer-ready")).toBe("disabled");
    expect(isFlagEnabled("local-installer-ready")).toBe(false);
  });

  describe("resolveCtaVariant", () => {
    it("gibt see-local-version zurück wenn Flag nicht gesetzt", () => {
      delete process.env["ALFRET_FLAG_LOCAL_INSTALLER_READY"];
      expect(resolveCtaVariant()).toBe("see-local-version");
    });

    it("gibt install-local-version zurück wenn Flag gesetzt", () => {
      process.env["ALFRET_FLAG_LOCAL_INSTALLER_READY"] = "1";
      expect(resolveCtaVariant()).toBe("install-local-version");
    });
  });

  describe("getCtaContent", () => {
    it("liefert korrekten Button-Text für see-local-version", () => {
      const cta = getCtaContent("see-local-version");
      expect(cta.buttonText).toBe("Lokale Version ansehen");
      expect(cta.buttonHref).toBe("/homelab");
    });

    it("liefert korrekten Button-Text für install-local-version", () => {
      const cta = getCtaContent("install-local-version");
      expect(cta.buttonText).toBe("ALFRET lokal installieren");
      expect(cta.buttonHref).toBe("/homelab/install");
    });
  });
});
