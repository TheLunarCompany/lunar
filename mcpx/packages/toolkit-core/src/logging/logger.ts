import { format, Logger, transports, createLogger } from "winston";
import {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
  RequestHandler,
} from "express";

import { env } from "../env.js";

const LokiTransport = require('winston-loki')

const { combine, timestamp, label, printf, splat, metadata } = format;

interface LunarLogger extends Logger {
  get telemetry(): Logger;
}

const logFormat = printf(({ level, message, label, metadata, timestamp }) => {
  const metaString = metadata
    ? Object.entries(metadata)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(" ")
    : "";
  return `${timestamp} [${label}] ${level.toUpperCase()}: ${message} ${metaString}`;
});

const defaultTelemetryLabels = {
  service: "mcpx",
  version: env.VERSION,
  instance_id: env.INSTANCE_ID,
  lunar_key: env.LUNAR_API_KEY,
};

export const noOpLogger: Logger = createLogger({ silent: true });

export function buildLogger(
  props: { logLevel: string; label?: string } = { logLevel: "info" }
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
    format:combinedFormat,
    transports: [new transports.Console()],
  });

  if (!env.LUNAR_TELEMETRY) {
    return Object.assign(baseLogger, {
      telemetry: noOpLogger,
    });
  }

  const telemetryLogger = createLogger({
    level: logLevel.toLowerCase(),
    format: combinedFormat,
    transports: [new LokiTransport({
      host: env.LOKI_URL,
      labels: { ...defaultTelemetryLabels, component: loggerLabel },
      json: true,
    })],
  });

  return Object.assign(baseLogger, {
    telemetry: telemetryLogger,
  });
}

// Middleware to log requests and responses
export function accessLogFor(
  logger: Logger,
  ignore: { method: string; path: string }[] = []
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
      logger.info(
        `[access-log] ${method} ${originalUrl} ${res.statusCode} - ${duration}ms`
      );
    });

    next();
  };
}
