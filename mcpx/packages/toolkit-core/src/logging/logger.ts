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

function redactValue(value: unknown, keysToRedact: Set<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, keysToRedact));
  }
  if (isPlainObject(value)) {
    return redactObject(value, keysToRedact);
  }
  return value;
}

export function redactObject(
  obj: Record<string, unknown>,
  keysToRedact: Set<string>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => {
      if (keysToRedact.has(key)) {
        return [key, "[REDACTED]"];
      }
      return [key, redactValue(value, keysToRedact)];
    }),
  );
}

function redactSensitiveFields(keysToRedact: Set<string>): Format {
  return format((info) => {
    if (isPlainObject(info["metadata"])) {
      info["metadata"] = redactObject(info["metadata"], keysToRedact);
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
  const formats = [
    label({ label: loggerLabel }),
    timestamp(),
    splat(),
    metadata({ fillExcept: ["message", "level", "timestamp", "label"] }),
    ...(redactKeys?.size ? [redactSensitiveFields(redactKeys)] : []),
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
        `[access-log] ${method} ${originalUrl} ${res.statusCode} - ${duration}ms`,
      );
    });

    next();
  };
}
