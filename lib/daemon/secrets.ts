// Prozessweites Register der Geheimnisse, die dieser Prozess kennt.
//
// credentials.ts dokumentiert seit jeher die Invariante "secretsOf() feeds the
// log scrubber" — angeschlossen war sie nie. createLogger() nimmt zwar ein
// scrub, aber kein einziger Aufrufer hat je eines übergeben, und
// scrubSecrets() wurde nur im Test aufgerufen. Ein Token, das über eine
// Fehlermeldung in eine Logzeile gerät, landete damit unmaskiert in journald.
//
// Das Register wird an genau einer Stelle gefüllt: dort, wo ein Geheimnis in
// den Prozess kommt. Der Logger fragt es bei jeder Zeile.

const known = new Set<string>();

/** Zu kurze Werte werden ignoriert — sonst maskiert man den halben Log. */
const MIN_SECRET_LENGTH = 8;

export function rememberSecret(secret: string | null | undefined): void {
  if (!secret || secret.length < MIN_SECRET_LENGTH) return;
  known.add(secret);
}

/** Nur für Tests — der laufende Prozess vergisst nichts. */
export function forgetAllSecrets(): void {
  known.clear();
}

export function knownSecretCount(): number {
  return known.size;
}

/** Zeigt höchstens die letzten vier Zeichen, wie redact() in credentials.ts. */
function mask(secret: string): string {
  return `***${secret.slice(-4)}`;
}

/**
 * Ersetzt jedes bekannte Geheimnis in einer fertigen Logzeile.
 * Wird als `scrub` an createLogger übergeben und läuft damit über JEDE Ausgabe,
 * egal ob das Geheimnis über msg, ein Feld oder eine verschachtelte
 * Fehlermeldung hineingeraten ist.
 */
export function scrubKnownSecrets(line: string): string {
  let out = line;
  for (const secret of known) out = out.replaceAll(secret, mask(secret));
  return out;
}
