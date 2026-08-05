// credentials.ts trägt die Invariante "secretsOf() feeds the log scrubber" seit
// jeher im Kopf — angeschlossen war sie nie: createLogger nahm ein `scrub`
// entgegen, das kein Aufrufer je übergab, und scrubSecrets() lief nur im Test.
// Ein Token, das über eine Fehlermeldung in eine Logzeile geriet, stand damit
// unmaskiert in journald.
//
// Diese Tests prüfen die Verdrahtung, nicht die Funktion für sich.

import { describe, it, expect, beforeEach } from "vitest";
import { createLogger } from "@/lib/daemon/log";
import {
  rememberSecret,
  scrubKnownSecrets,
  forgetAllSecrets,
  knownSecretCount,
} from "@/lib/daemon/secrets";

const TOKEN = "ghp_abcdefghijklmnopqrstuvwxyz0123456789";

function capturingLogger() {
  const lines: string[] = [];
  const log = createLogger({
    minLevel: "debug",
    scrub: scrubKnownSecrets,
    sink: (l) => lines.push(l),
  });
  return { log, lines };
}

describe("Secret-Register", () => {
  beforeEach(() => forgetAllSecrets());

  it("ignoriert zu kurze Werte, damit nicht der halbe Log maskiert wird", () => {
    rememberSecret("abc");
    rememberSecret("");
    rememberSecret(undefined);
    expect(knownSecretCount()).toBe(0);
  });

  it("nimmt ein echtes Token auf", () => {
    rememberSecret(TOKEN);
    expect(knownSecretCount()).toBe(1);
  });
});

describe("Logger mit angeschlossenem Scrubber", () => {
  beforeEach(() => forgetAllSecrets());

  it("maskiert das Token in der Nachricht", () => {
    rememberSecret(TOKEN);
    const { log, lines } = capturingLogger();
    log.error(`Request fehlgeschlagen mit ${TOKEN}`);
    expect(lines[0]).not.toContain(TOKEN);
    expect(lines[0]).toContain("***6789");
  });

  it("maskiert das Token auch in einem Feld", () => {
    rememberSecret(TOKEN);
    const { log, lines } = capturingLogger();
    log.warn("fehlgeschlagen", { error: `Bearer ${TOKEN} abgelehnt` });
    expect(lines[0]).not.toContain(TOKEN);
  });

  it("maskiert es auch, wenn es über einen child-Logger hereinkommt", () => {
    rememberSecret(TOKEN);
    const { log, lines } = capturingLogger();
    log.child({ repository: "owner/repo" }).error("kaputt", { detail: TOKEN });
    expect(lines[0]).not.toContain(TOKEN);
    expect(lines[0]).toContain("owner/repo");
  });

  it("zeigt höchstens die letzten vier Zeichen", () => {
    rememberSecret(TOKEN);
    expect(scrubKnownSecrets(TOKEN)).toBe("***6789");
  });

  it("lässt gewöhnliche Zeilen unangetastet", () => {
    rememberSecret(TOKEN);
    const { log, lines } = capturingLogger();
    log.info("tick complete", { repos: 3 });
    expect(lines[0]).toContain("tick complete");
    expect(lines[0]).toContain('"repos":3');
  });
});
