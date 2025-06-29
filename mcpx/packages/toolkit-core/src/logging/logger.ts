import { createLogger, format, Logger, transports } from "winston";
import {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
  RequestHandler,
} from "express";

const { combine, timestamp, label, printf, splat, metadata } = format;

const logFormat = printf(({ level, message, label, metadata, timestamp }) => {
  const metaString = metadata
    ? Object.entries(metadata)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(" ")
    : "";
  return `${timestamp} [${label}] ${level.toUpperCase()}: ${message} ${metaString}`;
});

// Currently console only
export function buildLogger(
  props: { logLevel: string; label?: string } = { logLevel: "info" }
): Logger {
  const { logLevel, label: loggerLabel } = props;
  return createLogger({
    level: logLevel.toLowerCase(),
    format: combine(
      label({ label: loggerLabel }),
      timestamp(),
      splat(),
      metadata({ fillExcept: ["message", "level", "timestamp", "label"] }),
      logFormat
    ),
    transports: [new transports.Console()],
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
      logger.info(`${method} ${originalUrl} ${res.statusCode} - ${duration}ms`);
    });

    next();
  };
}

export const noOpLogger: Logger = createLogger({ silent: true });
