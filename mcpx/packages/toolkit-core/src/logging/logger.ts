import { format, Logger, transports, createLogger } from "winston";
import { Format } from "logform";
import {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
  RequestHandler,
} from "express";

import LokiTransport from "winston-loki";

export type LogLevel =
  | "error"
  | "warn"
  | "info"
  | "http"
  | "verbose"
  | "debug"
  | "silly";

const { combine, timestamp, label, printf, splat, metadata } = format;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

// Collapses "Authorization", "api-key", "API_KEY" to one form for matching.
export function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[-_]/g, "");
}

// Keys redacted by default for every logger, pre-normalized at module load.
// Only protects values under a sensitive *key* — envelopes logged under benign
// keys (`body`, `data`) must be shaped at the call site (loggableHttpError).
export const DEFAULT_REDACT_KEYS: ReadonlySet<string> = new Set(
  [
    "authorization",
    "cookie",
    "set-cookie",
    "token",
    "accessToken",
    "refreshToken",
    "idToken",
    "bearer",
    "apiKey",
    "password",
    "secret",
    "clientSecret",
    "sessionId",
    "session",
    "credentials",
    "privateKey",
    "env",
    "headers",
  ].map(normalizeKey),
);

// Catches unlisted fields like `githubToken` by default. Substrings match
// anywhere; suffixes only at the end, so `tokenCount`/`cacheKey` stay visible.
// Bare `key` is excluded on purpose (too noisy).
const REDACT_KEY_SUBSTRINGS = ["password", "secret"].map(normalizeKey);
const REDACT_KEY_SUFFIXES = ["token", "apikey"].map(normalizeKey);

// Shared matcher: an exact key in `normalizedKeys`, or one carrying a sensitive
// stem (password/secret substring, token/apikey suffix). Reused by the audit
// log's sanitizer so the two can't drift on what counts as a secret.
export function isSensitiveKey(
  key: string,
  normalizedKeys: ReadonlySet<string>,
): boolean {
  const nk = normalizeKey(key);
  if (normalizedKeys.has(nk)) {
    return true;
  }
  if (REDACT_KEY_SUBSTRINGS.some((stem) => nk.includes(stem))) {
    return true;
  }
  return REDACT_KEY_SUFFIXES.some((suffix) => nk.endsWith(suffix));
}

// Guards against runaway recursion: `seen` breaks cycles, depth bounds deep
// acyclic structures. Both replace the subtree wholesale, so neither leaks.
const MAX_REDACT_DEPTH = 20;

function redactValue(
  value: unknown,
  normalizedKeys: ReadonlySet<string>,
  seen: WeakSet<object>,
  depth: number,
): unknown {
  const isArray = Array.isArray(value);
  if (isArray || isPlainObject(value)) {
    if (seen.has(value)) {
      return "[Circular]";
    }
    if (depth >= MAX_REDACT_DEPTH) {
      return "[Truncated]";
    }
    if (isArray) {
      seen.add(value);
      const result = value.map((item) =>
        redactValue(item, normalizedKeys, seen, depth + 1),
      );
      seen.delete(value);
      return result;
    }
    return redactObjectInternal(value, normalizedKeys, seen, depth + 1);
  }
  return value;
}

// Recursive core. Assumes `normalizedKeys` is already normalized — only the hot
// path (buildLogger, normalized once) calls this directly.
function redactObjectInternal(
  obj: Record<string, unknown>,
  normalizedKeys: ReadonlySet<string>,
  seen: WeakSet<object>,
  depth: number,
): Record<string, unknown> {
  seen.add(obj);
  const result = Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      if (isSensitiveKey(key, normalizedKeys)) {
        return [key, "[REDACTED]"];
      }
      return [key, redactValue(value, normalizedKeys, seen, depth)];
    }),
  );
  seen.delete(obj);
  return result;
}

// Public entry: normalizes the keys itself so it can't be called wrong.
export function redactObject(
  obj: Record<string, unknown>,
  keysToRedact: ReadonlySet<string>,
): Record<string, unknown> {
  const normalizedKeys = new Set([...keysToRedact].map(normalizeKey));
  return redactObjectInternal(obj, normalizedKeys, new WeakSet(), 0);
}

function redactSensitiveFields(normalizedKeys: ReadonlySet<string>): Format {
  return format((info) => {
    if (isPlainObject(info["metadata"])) {
      info["metadata"] = redactObjectInternal(
        info["metadata"],
        normalizedKeys,
        new WeakSet(),
        0,
      );
    }
    return info;
  })();
}

export interface LunarLogger extends Logger {
  get telemetry(): Logger;
}

interface LunarTelemetryLabels {
  service: string;
  version: string;
  instance_id: string;
  lunar_key: string;
}

export interface LunarTelemetryOptions {
  service: string;
  host: string;
  user: string;
  password: string;
  labels: LunarTelemetryLabels;
  // Optional: minimum log level mirrored from base logger to Loki (inclusive)
  // If not set, buildLogger's minTelemetryMirrorLevel or "error" is used
  minTelemetryMirrorLevel?: LogLevel;
}

const logFormat = printf(({ level, message, label, metadata, timestamp }) => {
  const metaString = metadata
    ? Object.entries(metadata)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(" ")
    : "";
  return `${timestamp} [${label}] ${level.toUpperCase()}: ${message} ${metaString}`;
});

const noOpTelemetryLogger = createLogger({ silent: true });

export const noOpLogger: LunarLogger = Object.assign(
  createLogger({ silent: true }),
  {
    telemetry: noOpTelemetryLogger,
  },
);

export function buildLogger(
  props: {
    logLevel: string;
    label?: string;
    telemetry?: LunarTelemetryOptions;
    redactKeys?: Set<string>;
  } = { logLevel: "info" },
): LunarLogger {
  const { logLevel, label: loggerLabel, redactKeys } = props;
  // Always on: defaults plus any caller keys, normalized once here.
  const effectiveRedactKeys = new Set(DEFAULT_REDACT_KEYS);
  for (const key of redactKeys ?? []) {
    effectiveRedactKeys.add(normalizeKey(key));
  }
  const formats = [
    label({ label: loggerLabel }),
    timestamp(),
    splat(),
    metadata({ fillExcept: ["message", "level", "timestamp", "label"] }),
    redactSensitiveFields(effectiveRedactKeys),
    logFormat,
  ];
  const combinedFormat = combine(...formats);

  const baseLogger = createLogger({
    level: logLevel.toLowerCase(),
    format: combinedFormat,
    transports: [new transports.Console()],
  });

  if (!props.telemetry) {
    return Object.assign(baseLogger, {
      telemetry: noOpLogger,
    });
  }

  function buildLokiTransport(
    telemetry: LunarTelemetryOptions,
    componentLabel: string | undefined,
    level?: LogLevel,
  ): LokiTransport {
    return new LokiTransport({
      host: telemetry.host,
      basicAuth: `${telemetry.user}:${telemetry.password}`,
      labels: { ...telemetry.labels, component: componentLabel },
      json: true,
      // Only set level if provided to avoid overriding defaults
      ...(level ? { level } : {}),
    });
  }

  // Create a Loki transport to mirror logs from the base logger
  // at or above the configured minimum level (default: error), so any logger
  // (including child loggers) sends those to telemetry.
  const mirrorLevel: LogLevel =
    props.telemetry?.minTelemetryMirrorLevel ?? "error";
  const mirroringLoki = buildLokiTransport(
    props.telemetry,
    loggerLabel,
    mirrorLevel,
  );

  // Attach the mirroring Loki transport to the base logger's transports
  baseLogger.add(mirroringLoki);

  // Full telemetry logger for explicit structured telemetry logs
  const telemetryLogger = createLogger({
    level: logLevel.toLowerCase(),
    format: combinedFormat,
    transports: [buildLokiTransport(props.telemetry, loggerLabel)],
  });

  const originalClose = baseLogger.close.bind(baseLogger);

  return Object.assign(baseLogger, {
    telemetry: telemetryLogger,
    close: () => {
      telemetryLogger.transports.forEach((transport) => transport.close?.());
      baseLogger.transports.forEach((transport) => transport.close?.());
      telemetryLogger.close();
      return originalClose();
    },
  });
}

// Redaction only cleans metadata, not message strings — so URLs logged in
// access lines need their own pass for secrets in the query (?access_token=…,
// OAuth ?code=…). `code` isn't caught by the key stems, hence the extra set.
const SENSITIVE_URL_PARAMS = new Set(["code"].map(normalizeKey));

export function redactUrl(url: string): string {
  const queryStart = url.indexOf("?");
  if (queryStart === -1) {
    return url;
  }
  const path = url.slice(0, queryStart);
  const params = new URLSearchParams(url.slice(queryStart + 1));
  let redacted = false;
  for (const key of new Set(params.keys())) {
    if (
      isSensitiveKey(key, DEFAULT_REDACT_KEYS) ||
      SENSITIVE_URL_PARAMS.has(normalizeKey(key))
    ) {
      params.set(key, "[REDACTED]");
      redacted = true;
    }
  }
  return redacted ? `${path}?${params.toString()}` : url;
}

// Middleware to log requests and responses
export function accessLogFor(
  logger: Logger,
  ignore: { method: string; path: string }[] = [],
  level: LogLevel = "info",
): RequestHandler {
  return function accessLog(
    req: ExpressRequest,
    res: ExpressResponse,
    next: NextFunction,
  ): void {
    const { method, originalUrl } = req;
    const primitiveIgnore = new Set(
      ignore.map((i) => `${i.method}:::${i.path}`),
    );
    if (primitiveIgnore.has(`${method}:::${originalUrl}`)) {
      return next();
    }

    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      logger[level](
        `[access-log] ${method} ${redactUrl(originalUrl)} ${res.statusCode} - ${duration}ms`,
      );
    });

    next();
  };
}
