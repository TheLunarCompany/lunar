import { format, Logger, transports, createLogger } from "winston";
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

export const noOpLogger: LunarLogger = Object.assign(createLogger({ silent: true }), {
  telemetry: noOpTelemetryLogger,
});

export function buildLogger(
  props: {
    logLevel: string;
    label?: string;
    telemetry?: LunarTelemetryOptions;
  } = { logLevel: "info" }
): LunarLogger {
  const { logLevel, label: loggerLabel } = props;
  const combinedFormat = combine(
    label({ label: loggerLabel }),
    timestamp(),
    splat(),
    metadata({ fillExcept: ["message", "level", "timestamp", "label"] }),
    logFormat
  );

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

  // Create a Loki transport to mirror error-level logs from the base logger
  // so that any logger (including child loggers) sends errors to telemetry.
  const errorMirroringLoki = new LokiTransport({
    host: props.telemetry?.host,
    basicAuth: `${props.telemetry?.user}:${props.telemetry?.password}`,
    labels: { ...props.telemetry?.labels, component: loggerLabel },
    json: true,
    level: "error",
  });

  // Attach the error-only Loki transport to the base logger's transports
  baseLogger.add(errorMirroringLoki);

  // Full telemetry logger for explicit structured telemetry logs
  const telemetryLogger = createLogger({
    level: logLevel.toLowerCase(),
    format: combinedFormat,
    transports: [
      new LokiTransport({
        host: props.telemetry?.host,
        basicAuth: `${props.telemetry?.user}:${props.telemetry?.password}`,
        labels: { ...props.telemetry?.labels, component: loggerLabel },
        json: true,
      }),
    ],
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
  level: LogLevel = "info"
): RequestHandler {
  return function accessLog(
    req: ExpressRequest,
    res: ExpressResponse,
    next: NextFunction
  ): void {
    const { method, originalUrl } = req;
    const primitiveIgnore = new Set(
      ignore.map((i) => `${i.method}:::${i.path}`)
    );
    if (primitiveIgnore.has(`${method}:::${originalUrl}`)) {
      return next();
    }

    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      logger[level](
        `[access-log] ${method} ${originalUrl} ${res.statusCode} - ${duration}ms`
      );
    });

    next();
  };
}
