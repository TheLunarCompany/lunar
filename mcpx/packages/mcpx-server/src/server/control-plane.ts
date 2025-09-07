import {
  applyParsedAppConfigRequestSchema,
  initiateServerAuthRequestSchema,
} from "@mcpx/shared-model";
import { makeError } from "@mcpx/toolkit-core/data";
import { loggableError } from "@mcpx/toolkit-core/logging";
import { withPolling } from "@mcpx/toolkit-core/time";
import express, { Router } from "express";
import { Logger } from "winston";
import z, { ZodError } from "zod/v4";
import { env } from "../env.js";
import {
  AlreadyExistsError,
  FailedToConnectToTargetServer,
  InvalidConfigError,
  NotFoundError,
} from "../errors.js";
import {
  createTargetServerSchema,
  targetServerSchema,
} from "../model/target-servers.js";
import { Services } from "../services/services.js";
import { redactEnv } from "../services/redact.js";

export function buildControlPlaneRouter(
  authGuard: express.RequestHandler,
  services: Services,
  logger: Logger,
): Router {
  const router = Router();

  if (!env.ENABLE_CONTROL_PLANE_REST) {
    logger.debug(
      "Control Plane REST API is disabled. Skipping control plane routes.",
    );
    return router;
  }
  router.get("/system-state", authGuard, async (_req, res) => {
    const response = services.controlPlane.getSystemState();
    res.status(200).json(response);
  });

  router.get("/app-config", authGuard, async (_req, res) => {
    const payload = services.controlPlane.getAppConfig();
    res.status(200).json(payload);
  });

  router.patch("/app-config", authGuard, async (req, res) => {
    const parsed = applyParsedAppConfigRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      handleInvalidRequestSchema(req.url, res, parsed.error, req.body, logger);
      return;
    }

    const payload = parsed.data;
    try {
      const response = await services.controlPlane.patchAppConfig(payload);
      res.status(200).json(response);
      return;
    } catch (e) {
      if (e instanceof ZodError) {
        handleInvalidRequestSchema(req.url, res, e, req.body, logger);
        return;
      }
      if (e instanceof InvalidConfigError) {
        logger.error("Invalid config in PATCH /app-config request", {
          payload,
          error: loggableError(e),
        });
        res.status(400).json({
          message: "Invalid config",
          error: loggableError(e).errorMessage,
        });
        return;
      }
      const error = loggableError(e);
      logger.error("Error in PATCH /app-config request", { payload, error });
      res
        .status(500)
        .json({ message: "Internal server error", error: error.errorMessage });
      return;
    }
  });

  router.post("/target-server", authGuard, async (req, res) => {
    const parsed = createTargetServerSchema.safeParse(req.body);
    if (!parsed.success) {
      handleInvalidRequestSchema(req.url, res, parsed.error, req.body, logger);
      return;
    }

    const payload = parsed.data;
    try {
      const result = await services.controlPlane.addTargetServer(payload);
      res.status(201).json(result);
    } catch (e: unknown) {
      const error = loggableError(e);
      if (e instanceof FailedToConnectToTargetServer) {
        res.status(400).json({
          message: e.message,
          error,
        });
        return;
      }
      if (e instanceof AlreadyExistsError) {
        res
          .status(409)
          .json({ message: "Target server already exists", error });
        return;
      }
      logger.error("Error creating target server", {
        error,
        payload: redactEnv(payload),
      });
      res.status(500).json({
        message: "Internal server error",
        error: error.errorMessage,
      });
    }
  });

  router.patch("/target-server/:name", authGuard, async (req, res) => {
    const parsed = targetServerSchema.safeParse(req.body);
    if (!parsed.success) {
      handleInvalidRequestSchema(req.url, res, parsed.error, req.body, logger);
      return;
    }

    const payload = parsed.data;
    const name = req.params["name"];
    if (!name) {
      res.status(400).json({ message: "Target server name is required" });
      return;
    }
    try {
      const result = await services.controlPlane.updateTargetServer(
        name,
        payload,
      );
      res.status(200).json(result);
    } catch (e) {
      if (e instanceof NotFoundError) {
        logger.error(`Target server ${name} not found`, {
          payload: redactEnv(payload),
        });
        res.status(404).json({
          message: `Target server ${name} not found`,
          error: loggableError(e),
        });
        return;
      }
      const error = loggableError(e);
      logger.error("Error updating target server", {
        error,
        payload: redactEnv(payload),
      });
      res.status(500).json({
        message: "Internal server error",
        error: error.errorMessage,
      });
      return;
    }
  });

  router.delete("/target-server/:name", authGuard, async (req, res) => {
    const name = req.params["name"];
    if (!name) {
      res.status(400).json({ message: "Target server name is required" });
      return;
    }
    try {
      await services.controlPlane.removeTargetServer(name);
      res.status(200).json({ message: "Target server removed successfully" });
    } catch (e) {
      if (e instanceof NotFoundError) {
        logger.error(`Target server ${name} not found for removal`, { name });
        res.status(404).json({
          message: `Target server ${name} not found`,
          error: loggableError(e),
        });
        return;
      }
      const error = loggableError(e);
      logger.error("Error removing target server", { error, name });
      res.status(500).json({
        message: "Internal server error",
        error: error.errorMessage,
      });
    }
  });

  router.post("/auth/initiate/:name", authGuard, async (req, res) => {
    const name = req.params["name"];
    if (!name) {
      res.status(400).json({ message: "Target server name is required" });
      return;
    }

    const targetClient = services.targetClients.clientsByService.get(name);
    if (!targetClient) {
      res.status(404).json({
        message: `Target client ${name} not found`,
      });
      return;
    }
    if (targetClient._state !== "pending-auth") {
      res.status(400).json({
        message: `Target client ${name} is not in pendingAuth state`,
        state: targetClient._state,
      });
      return;
    }

    const parsedBody = initiateServerAuthRequestSchema.safeParse(req.body);
    const callbackUrl = parsedBody.success
      ? parsedBody.data.callbackUrl
      : undefined;

    try {
      const authProvider =
        services.oauthSessionManager.getOrCreateOAuthProvider(name, {
          callbackUrl,
        });

      try {
        await services.targetClients.reuseOAuthByName(name);
        res.status(200).json({
          msg: "Successfully reused OAuth tokens for target server",
          targetServerName: name,
          authorizationUrl: null,
        });
        return;
      } catch (_e) {
        logger.info("Could not reuse OAuth tokens, will initiate new flow", {
          targetServerName: name,
        });
      }
      let initiateOAuthError: Error | undefined;
      void services.targetClients.initiateOAuth(name).catch((e) => {
        initiateOAuthError = makeError(e);
      });

      let authorizationUrl: URL;
      try {
        authorizationUrl = await withPolling({
          maxAttempts: env.OAUTH_TIMEOUT_SECONDS,
          sleepTimeMs: 1000,
          getValue: () => authProvider.getAuthorizationUrl(),
          found: (url): url is URL => Boolean(url),
        });
      } catch (e) {
        const pollingError = makeError(e);
        logger.error("Failed to initiate OAuth flow", {
          targetServerName: name,
          error: loggableError(initiateOAuthError || pollingError),
        });
        res.status(500).json({
          message: "Failed to initiate OAuth flow",
          error: loggableError(initiateOAuthError || pollingError),
        });
        return;
      }

      res.status(202).json({
        msg: "Successfully initiated OAuth flow for target server",
        targetServerName: name,
        authorizationUrl: authorizationUrl.toString(),
      });
    } catch (e) {
      res
        .status(500)
        .json({ message: "Failed to initiate OAuth", error: loggableError(e) });
    }
  });

  return router;
}

function handleInvalidRequestSchema(
  name: string,
  res: express.Response,
  error: ZodError,
  payload: unknown,
  logger: Logger,
): void {
  const treeifiedError = z.treeifyError(error);

  logger.error(`Invalid schema in ${name} request`, {
    payload,
    error: treeifiedError,
  });
  res.status(400).json({
    message: "Invalid request schema",
    error: treeifiedError,
  });
}
