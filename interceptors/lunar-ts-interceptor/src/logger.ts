import { loadStrFromEnv } from "./helper"
import { createLogger, transports, format } from "winston";

export const logger = createLogger({
  level: loadStrFromEnv("LUNAR_INTERCEPTOR_LOG_LEVEL", "info").toLowerCase(),
  format: format.combine(
    format.timestamp(),
    format.printf(({ timestamp, level, message }) => {
      return `${timestamp} - lunar-interceptor - ${level.toUpperCase()}: ${message}`;
    }),
  ),
  transports: [new transports.Console()],
});
