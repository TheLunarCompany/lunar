import type { NextFunction, Request, Response } from "express";
import { HubConnectionError, HubService } from "../services/hub.js";
import { Logger } from "winston";

export type HubConnectionGuard = (
  rq: Request,
  rs: Response,
  f: NextFunction,
) => void;

export const noOpHubConnectionGuard: HubConnectionGuard = (
  _req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  next();
};

export type HubConnectionCheckResult =
  | { allowed: true }
  | {
      allowed: false;
      status: string;
      connectionError: HubConnectionError | undefined;
    };

/**
 * Checks if connection should be allowed based on hub authentication status.
 * Pure logic that can be reused in both Express middleware and Socket.IO handlers.
 */
export function checkHubConnection(
  hubService: HubService,
  enforceConnection: boolean,
): HubConnectionCheckResult {
  if (!enforceConnection) {
    return { allowed: true };
  }

  const { status, connectionError } = hubService.status;

  if (status === "authenticated") {
    return { allowed: true };
  }

  return {
    allowed: false,
    status,
    connectionError,
  };
}

/**
 * Builds an Express middleware that enforces hub connection for routes.
 * - When enforceConnection is false: allows all requests
 * - When enforceConnection is true and hub is authenticated: allows requests
 * - When enforceConnection is true and hub is not authenticated: returns 503
 */
export function makeHubConnectionGuard(
  hubService: HubService,
  enforceConnection: boolean,
  logger: Logger,
): HubConnectionGuard {
  if (!enforceConnection) {
    logger.info("Hub connection enforcement is disabled");
    return noOpHubConnectionGuard;
  }

  logger.info("Hub connection enforcement is enabled");

  return function (req: Request, res: Response, next: NextFunction): void {
    const result = checkHubConnection(hubService, enforceConnection);

    if (result.allowed) {
      next();
      return;
    }

    logger.debug("Blocking request - hub not connected", {
      path: req.path,
      status: result.status,
      connectionError: result.connectionError?.toJSON(),
    });

    res.status(503).json({
      error: "Service Unavailable",
      message: "Server requires active hub connection",
      hubStatus: result.status,
      connectionError: result.connectionError?.toJSON(),
    });
  };
}
