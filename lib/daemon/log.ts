// Strukturierter JSON-Line-Logger. Jede Zeile ist ein JSON-Objekt (ndjson).
// Kein File-Rotation — das übernimmt journald / launchd / nohup-Wrapper.
// child() erzeugt einen Logger, der alle Felder des Eltern-Loggers erbt.
// scrub() wird am Sink aufgerufen — alle Ausgaben durchlaufen sie.
// Tokens dürfen nie in Fields landen; das ist Konvention, kein technisches Mittel.

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
  [key: string]: unknown;
}

export interface DaemonLogger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): DaemonLogger;
}

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface CreateLoggerOptions {
  minLevel?: LogLevel;
  /** Wird auf die fertige JSON-Zeile angewendet, bevor sie geschrieben wird.
   *  Nutzen: Tokens/PATs aus Logs entfernen. */
  scrub?: (line: string) => string;
  /** Überschreibbar für Tests. Default: process.stdout.write. */
  sink?: (line: string) => void;
  /** Initiale Felder, die an jedes Log-Entry angehängt werden. */
  baseFields?: Record<string, unknown>;
}

export function createLogger(opts: CreateLoggerOptions = {}): DaemonLogger {
  const minLevel = opts.minLevel ?? "info";
  const scrub = opts.scrub ?? ((l: string) => l);
  const sink = opts.sink ?? ((l: string) => process.stdout.write(l + "\n"));
  const baseFields = opts.baseFields ?? {};

  function write(level: LogLevel, msg: string, fields: Record<string, unknown> = {}): void {
    if (LEVELS[level] < LEVELS[minLevel]) return;

    const entry: LogEntry = {
      ts: new Date().toISOString(),
      level,
      msg,
      ...baseFields,
      ...fields,
    };

    sink(scrub(JSON.stringify(entry)));
  }

  const logger: DaemonLogger = {
    debug: (msg, f) => write("debug", msg, f),
    info: (msg, f) => write("info", msg, f),
    warn: (msg, f) => write("warn", msg, f),
    error: (msg, f) => write("error", msg, f),
    child: (fields) =>
      createLogger({
        minLevel,
        scrub,
        sink,
        baseFields: { ...baseFields, ...fields },
      }),
  };

  return logger;
}
