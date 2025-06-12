import { createLogger, format, Logger, transports } from "winston";
import {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
  RequestHandler,
} from "express";
import dotenv from "dotenv";

dotenv.config();

const { combine, timestamp, label, printf, splat, metadata } = format;

const logFormat = printf(({ level, message, label, metadata, timestamp }) => {
  const metaString = metadata
    ? Object.entries(metadata)
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(" ")
    : "";
  return `${timestamp} [${label}] ${level.toUpperCase()}: ${message} ${metaString}`;
});

// Global logger instances
// TODO: refactor to DI
export const logger = buildLogger("mcpx");

function buildLogger(lbl: string): Logger {
  return createLogger({
    level: (process.env["LOG_LEVEL"] || "info").toLowerCase(),
    format: combine(
      label({ label: lbl }),
      timestamp(),
      splat(),
      metadata({ fillExcept: ["message", "level", "timestamp", "label"] }),
      logFormat,
    ),
    transports: [new transports.Console()],
  });
}

// Middleware to log requests and responses
export function accessLogFor(logger: Logger): RequestHandler {
  return function accessLog(
    req: ExpressRequest,
    res: ExpressResponse,
    next: NextFunction,
  ): void {
    const { method, originalUrl } = req;
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      logger.info(`${method} ${originalUrl} ${res.statusCode} - ${duration}ms`);
    });

    next();
  };
}
