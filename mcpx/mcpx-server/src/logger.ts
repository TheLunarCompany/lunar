import { createLogger, format, transports } from "winston";
import {
  NextFunction,
  Request as ExpressRequest,
  Response as ExpressResponse,
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

// A global logger instance
export const logger = createLogger({
  level: process.env["LOG_LEVEL"] || "info",
  format: combine(
    label({ label: "mcpx" }),
    timestamp(),
    splat(),
    metadata({ fillExcept: ["message", "level", "timestamp", "label"] }),
    logFormat,
  ),
  transports: [new transports.Console()],
});

// Middleware to log requests and responses
export function accessLog(
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
}
