import {
  applyParsedAppConfigRequestSchema,
  CatalogMCPServerItem,
  CreateServerFromCatalogRequest,
  createServerFromCatalogRequestSchema,
  createTargetServerRequestSchema,
  initiateServerAuthRequestSchema,
  TargetServerRequest,
} from "@mcpx/shared-model";
import { makeError } from "@mcpx/toolkit-core/data";
import { loggableError } from "@mcpx/toolkit-core/logging";
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
import { targetServerSchema } from "../model/target-servers.js";
import { Services } from "../services/services.js";
import { redactEnv } from "../services/redact.js";
import {
  resolveEnvToRuntime,
  MissingRequiredEnvError,
} from "../services/env-resolver.js";

function buildTargetServerRequest(
  server: CatalogMCPServerItem,
  request: CreateServerFromCatalogRequest,
): TargetServerRequest {
  const { config } = server;

  if (config.type === "stdio") {
    return {
      type: "stdio",
      name: server.name,
      command: config.command,
      args: config.args ?? [],
      env: resolveEnvToRuntime(config.env, request.envValues ?? {}),
    };
  }

  return {
    type: config.type,
    name: server.name,
    url: config.url,
    headers: config.headers,
  };
}

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
    const parsed = createTargetServerRequestSchema.safeParse(req.body);
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

  router.post(
    "/catalog-item/:id/target-server",
    authGuard,
    async (req, res) => {
      const catalogItemId = req.params["id"];
      if (!catalogItemId) {
        res.status(400).json({ message: "Catalog item ID is required" });
        return;
      }

      const parsed = createServerFromCatalogRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        handleInvalidRequestSchema(
          req.url,
          res,
          parsed.error,
          req.body,
          logger,
        );
        return;
      }

      const catalogItem = services.catalogManager.getById(catalogItemId);
      if (!catalogItem) {
        res.status(404).json({ message: "Catalog item not found" });
        return;
      }

      try {
        const targetServerRequest = buildTargetServerRequest(
          catalogItem.server,
          parsed.data,
        );
        const result =
          await services.controlPlane.addTargetServer(targetServerRequest);
        res.status(201).json(result);
      } catch (e: unknown) {
        if (e instanceof MissingRequiredEnvError) {
          res.status(400).json({
            message: `Missing required environment variables [${e.missingKeys.join(", ")}]`,
            missingKeys: e.missingKeys,
          });
          return;
        }
        const error = loggableError(e);
        if (e instanceof FailedToConnectToTargetServer) {
          res.status(400).json({ message: e.message, error });
          return;
        }
        if (e instanceof AlreadyExistsError) {
          res
            .status(409)
            .json({ message: "Target server already exists", error });
          return;
        }
        logger.error("Error creating target server from catalog", {
          error,
          catalogItemId,
        });
        res.status(500).json({
          message: "Internal server error",
          error: error.errorMessage,
        });
      }
    },
  );

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

  // In deprecation, use PUT config/target-server/:name/activate
  router.put("/target-server/:name/activate", authGuard, async (req, res) => {
    const name = req.params["name"];
    if (!name) {
      res.status(400).json({ message: "Target server name is required" });
      return;
    }
    try {
      await services.controlPlane.config.activateTargetServer(name);
      logger.info("Activated target server", { name });
      res.status(200).json({ message: "Target server activated successfully" });
    } catch (e) {
      const error = loggableError(e);
      logger.error("Error activating target server", { error, name });
      res.status(500).json(error);
    }
  });

  // In deprecation, use PUT config/target-server/:name/deactivate
  router.put("/target-server/:name/deactivate", authGuard, async (req, res) => {
    const name = req.params["name"];
    if (!name) {
      res.status(400).json({ message: "Target server name is required" });
      return;
    }
    try {
      await services.controlPlane.config.deactivateTargetServer(name);
      logger.info("Deactivated target server", { name });
      res
        .status(200)
        .json({ message: "Target server deactivated successfully" });
    } catch (e) {
      const error = loggableError(e);
      logger.error("Error deactivating target server", { error, name });
      res.status(500).json(error);
    }
  });

  // In deprecation, use GET config/target-servers/attributes
  router.get("/target-servers/attributes", authGuard, async (_req, res) => {
    try {
      const targetServerAttributes =
        services.controlPlane.config.getTargetServerAttributes();
      res.status(200).json({ targetServerAttributes });
    } catch (e) {
      const error = loggableError(e);
      logger.error("Error fetching target server attributes", { error });
      res.status(500).json(error);
    }
  });

  router.post("/auth/initiate/:name", authGuard, async (req, res) => {
    const name = req.params["name"];
    if (!name) {
      res.status(400).json({ message: "Target server name is required" });
      return;
    }

    const parsedBody = initiateServerAuthRequestSchema.safeParse(req.body);
    const callbackUrl = parsedBody.data?.callbackUrl
      ? parsedBody.data.callbackUrl
      : undefined;

    try {
      // Try to reuse existing OAuth tokens first
      try {
        await services.targetClients.reuseOAuthByName(name);
        res.status(200).json({
          msg: "Successfully reused OAuth tokens for target server",
          targetServerName: name,
          authorizationUrl: null,
          userCode: null,
        });
        return;
      } catch (_e) {
        logger.info("Could not reuse OAuth tokens, will initiate new flow", {
          targetServerName: name,
        });
      }

      // Initiate new OAuth flow
      const result = await services.targetClients.initiateOAuthForServer(
        name,
        callbackUrl,
      );

      res.status(202).json({
        msg: "Successfully initiated OAuth flow for target server",
        targetServerName: name,
        authorizationUrl: result.authorizationUrl,
        userCode: result.userCode ?? null,
      });
    } catch (e) {
      const error = makeError(e);
      logger.error("Failed to initiate OAuth flow", {
        targetServerName: name,
        error: loggableError(error),
      });
      res
        .status(500)
        .json({ message: "Failed to initiate OAuth", error: loggableError(e) });
    }
  });

  // Auth callback endpoint - redirects to OAuth callback
  router.get(
    "/auth/callback",
    (req: express.Request, res: express.Response) => {
      const { code, state, error } = req.query;

      // Redirect to the OAuth callback endpoint with the same query parameters
      const queryParams = new URLSearchParams();
      if (code) queryParams.set("code", code as string);
      if (state) queryParams.set("state", state as string);
      if (error) queryParams.set("error", error as string);

      const redirectUrl = `/oauth/callback${queryParams.toString() ? "?" + queryParams.toString() : ""}`;
      res.redirect(redirectUrl);
    },
  );

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
