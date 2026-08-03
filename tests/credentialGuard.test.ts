// Datenhoheit: ein Token, das auf einer fremden Instanz ankommt, ist aus der
// Hand gegeben. Diese Tests halten fest, in welchem Profil das überhaupt
// passieren darf — und dass die Voreinstellung die strengste ist.

import { describe, it, expect } from "vitest";
import {
  acceptsForeignCredentials,
  refuseForeignCredentials,
} from "@/lib/profile/credentialGuard";
import { resolveOperatingProfile, DEFAULT_OPERATING_PROFILE } from "@/lib/profile/operating";
import { scopeActionSchema } from "@/lib/schema/scope";
import { operatingProfileSchema, type OperatingProfile } from "@/lib/schema/homelab";

const ALL_PROFILES = operatingProfileSchema.options.map(
  (o) => o.value,
) as OperatingProfile[];

describe("Voreinstellung", () => {
  it("ist das strengste Profil, wenn ALFRET_PROFILE fehlt", () => {
    expect(resolveOperatingProfile({})).toBe("production");
    expect(DEFAULT_OPERATING_PROFILE).toBe("production");
  });

  it("fällt bei einem unbekannten Wert nicht nach oben durch", () => {
    expect(resolveOperatingProfile({ ALFRET_PROFILE: "homelab-ish" })).toBe("production");
    expect(resolveOperatingProfile({ ALFRET_PROFILE: "" })).toBe("production");
  });

  it("liest das Profil ausschließlich aus der Umgebung — nie aus einem Header", () => {
    // resolveOperatingProfile nimmt kein Request-Objekt entgegen. Gäbe es
    // wieder einen Header-Pfad, ließe sich diese Signatur nicht halten.
    expect(resolveOperatingProfile.length).toBeLessThanOrEqual(1);
    expect(resolveOperatingProfile({ ALFRET_PROFILE: "homelab" })).toBe("homelab");
  });
});

describe("acceptsForeignCredentials", () => {
  it("erlaubt Zugangsdaten nur, wo Betreiber und Besitzer dieselbe Person sind", () => {
    const accepting = ALL_PROFILES.filter(acceptsForeignCredentials).sort();
    expect(accepting).toEqual(["homelab", "local-dev"]);
  });
});

describe("refuseForeignCredentials", () => {
  it("lässt jeden Request ohne Geheimnis durch — auch im strengsten Profil", () => {
    expect(refuseForeignCredentials([], "production")).toBeNull();
    expect(refuseForeignCredentials([undefined, null, ""], "production")).toBeNull();
    expect(refuseForeignCredentials(["   "], "production")).toBeNull();
  });

  it("weist ein Token im öffentlichen Profil mit 403 ab", () => {
    const res = refuseForeignCredentials(["ghp_wasauchimmer"], "production");
    expect(res?.status).toBe(403);
  });

  it("weist auch im ci-Profil ab", () => {
    expect(refuseForeignCredentials(["ghp_x"], "ci")?.status).toBe(403);
  });

  it("lässt dasselbe Token auf der eigenen Maschine durch", () => {
    expect(refuseForeignCredentials(["ghp_x"], "homelab")).toBeNull();
    expect(refuseForeignCredentials(["ghp_x"], "local-dev")).toBeNull();
  });

  it("erklärt in der Antwort, warum — und wie man es richtig macht", async () => {
    const res = refuseForeignCredentials(["ghp_x"], "production")!;
    const body = await res.json();
    expect(body.error).toMatch(/ALFRET_PROFILE=homelab/);
    expect(body.reason).toBe("credentials-not-accepted-in-this-profile");
  });

  it("gibt das Geheimnis nicht in der eigenen Fehlermeldung zurück", async () => {
    const res = refuseForeignCredentials(["ghp_streng_geheim_1234"], "production")!;
    expect(JSON.stringify(await res.json())).not.toContain("ghp_streng_geheim_1234");
  });
});

describe("Scope-Vokabular", () => {
  it("kennt keine Aktion, die Daten nach außen gibt, ohne dass sie freigegeben wäre", () => {
    // Jede Aktion, die schreibt oder ausführt, muss einzeln in der Registry
    // stehen. Es gibt bewusst keine Sammel-Aktion.
    expect(scopeActionSchema.options).toContain("observe");
    expect(scopeActionSchema.options).not.toContain("all");
  });
});
