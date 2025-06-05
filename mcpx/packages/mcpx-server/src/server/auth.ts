import type { NextFunction, Request, Response } from "express";
import { ConfigManager } from "../config.js";
import { mcpxLogger } from "../logger.js";

const DEFAULT_API_KEY_HEADER = "x-lunar-api-key";

const noOp = (_req: Request, _res: Response, next: NextFunction): void => {
  next();
};

/**
 * Builds an Express middleware that enforces the “API key” header for the
 * routes you mount it on, given on loaded configuration.
 * - 401  when the header is missing
 * - 403  when the key is present but wrong
 * - calls `next()` when auth is disabled **or** the key is valid
 */
export function buildApiKeyGuard(
  config: ConfigManager,
  apiKey?: string,
): (req: Request, res: Response, next: NextFunction) => void {
  if (!config.getConfig().auth?.enabled) {
    mcpxLogger.info("API key guard is not enabled");
    return noOp;
  }
  if (!apiKey) {
    mcpxLogger.warn("API key guard is enabled but no API key configured");
    return noOp;
  }
  mcpxLogger.info("API key guard is enabled");
  return function (req: Request, res: Response, next: NextFunction): void {
    const headerName = (
      config.getConfig().auth.header ?? DEFAULT_API_KEY_HEADER
    ).toLowerCase();

    const supplied = req.headers[headerName] as string | undefined;

    if (!supplied) {
      mcpxLogger.warn(
        "API key not provided in headers, will not allow connection",
      );
      res.status(401).send("Unauthorized: API key required");
      return;
    }

    if (supplied !== apiKey) {
      mcpxLogger.warn("Invalid API key provided, will not allow connection");
      res.status(403).send("Forbidden: Invalid API key");
      return;
    }

    next();
  };
}
