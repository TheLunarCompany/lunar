import type { NextFunction, Request, Response } from "express";
import { ConfigService } from "../config.js";
import { Logger } from "winston";

const DEFAULT_API_KEY_HEADER = "x-lunar-api-key";

export type AuthGuard = (rq: Request, rs: Response, f: NextFunction) => void;
export const noOpAuthGuard: AuthGuard = (
  _req: Request,
  _res: Response,
  next: NextFunction,
): void => {
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
  config: ConfigService,
  logger: Logger,
  apiKey?: string,
): AuthGuard {
  if (!config.getConfig().auth?.enabled) {
    logger.info("API key guard is not enabled");
    return noOpAuthGuard;
  }
  if (!apiKey) {
    logger.warn("API key guard is enabled but no API key configured");
    return noOpAuthGuard;
  }
  logger.info("API key guard is enabled");
  return function (req: Request, res: Response, next: NextFunction): void {
    const headerName = (
      config.getConfig().auth.header ?? DEFAULT_API_KEY_HEADER
    ).toLowerCase();

    const supplied = req.headers[headerName] as string | undefined;

    if (!supplied) {
      logger.warn("API key not provided in headers, will not allow connection");
      res.status(401).send("Unauthorized: API key required");
      return;
    }

    if (supplied !== apiKey) {
      logger.warn("Invalid API key provided, will not allow connection");
      res.status(403).send("Forbidden: Invalid API key");
      return;
    }

    next();
  };
}

export function checkSocketAuth(
  config: ConfigService,
  logger: Logger,
  apiKey: string | undefined,
  headers: Record<string, string | string[] | undefined>,
  auth: Record<string, any> | undefined,
): { allowed: boolean; error?: string } {
  if (!config.getConfig().auth?.enabled) {
    return { allowed: true };
  }
  if (!apiKey) {
    return { allowed: true };
  }

  const headerName = (
    config.getConfig().auth.header ?? DEFAULT_API_KEY_HEADER
  ).toLowerCase();

  const supplied =
    (headers[headerName] as string | undefined) ||
    (typeof headers["authorization"] === "string"
      ? headers["authorization"].replace(/^Bearer /i, "")
      : undefined) ||
    (auth?.apiKey as string | undefined) ||
    (auth?.token as string | undefined);

  if (!supplied) {
    logger.warn("API key not provided for WebSocket connection");
    return { allowed: false, error: "Unauthorized: API key required" };
  }

  if (supplied !== apiKey) {
    logger.warn("Invalid API key provided for WebSocket connection");
    return { allowed: false, error: "Forbidden: Invalid API key" };
  }

  return { allowed: true };
}
