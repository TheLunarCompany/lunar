import type { NextFunction, Request, Response } from "express";
import { HubService } from "../services/hub.js";
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
    const { status, connectionError } = hubService.status;

    if (status === "authenticated") {
      next();
      return;
    }

    logger.debug("Blocking request - hub not connected", {
      path: req.path,
      status,
      connectionError: connectionError?.toJSON(),
    });

    res.status(503).json({
      error: "Service Unavailable",
      message: "Server requires active hub connection",
      hubStatus: status,
      connectionError: connectionError?.toJSON(),
    });
  };
}
