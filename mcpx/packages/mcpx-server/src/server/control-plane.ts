import {
  applyParsedAppConfigRequestSchema,
  createTargetServerRequestSchema,
  updateTargetServerRequestSchema,
} from "@mcpx/shared-model";
import { loggableError } from "@mcpx/toolkit-core/logging";
import express, { Router } from "express";
import { Logger } from "winston";
import z, { ZodError } from "zod/v4";
import {
  AlreadyExistsError,
  FailedToConnectToTargetServer,
  NotFoundError,
} from "../errors.js";
import { Services } from "../services/services.js";
import { env } from "../env.js";

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
    } catch (e) {
      if (e instanceof ZodError) {
        handleInvalidRequestSchema(req.url, res, e, req.body, logger);
      }
      const error = loggableError(e);
      logger.error("Error in PatchAppConfig request", { payload, error });
      res
        .status(500)
        .json({ message: "Internal server error", error: error.errorMessage });
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
      await services.controlPlane.addTargetServer(payload);
      res.status(201).json({ message: "Target server created successfully" });
    } catch (e: unknown) {
      const error = loggableError(e);
      if (e instanceof FailedToConnectToTargetServer) {
        res.status(400).json({
          message: "Failed to connect to target server",
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
      logger.error("Error creating target server", { error, payload });
      res.status(500).json({
        message: "Internal server error",
        error: error.errorMessage,
      });
    }
  });

  router.patch("/target-server/:name", authGuard, async (req, res) => {
    const parsed = updateTargetServerRequestSchema.safeParse(req.body);
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
      await services.controlPlane.updateTargetServer(name, payload);
      res.status(200).json({ message: "Target server updated successfully" });
    } catch (e) {
      if (e instanceof NotFoundError) {
        logger.error(`Target server ${name} not found`, { payload });
        res.status(404).json({
          message: `Target server ${name} not found`,
          error: loggableError(e),
        });
        return;
      }
      const error = loggableError(e);
      logger.error("Error updating target server", { error, payload });
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
  logger.error(`Invalid config schema in ${name} request`, {
    payload,
    error: treeifiedError,
  });
  res.status(400).json({
    message: "Invalid request schema",
    error: treeifiedError,
  });
}
