import { appConfigSchema } from "@mcpx/shared-model";
import {
  applyRawAppConfigRequestSchema,
  createTargetServerRequestSchema,
  updateTargetServerRequestSchema,
} from "@mcpx/shared-model/api";
import { loggableError } from "@mcpx/toolkit-core/logging";
import { AxiosError } from "axios";
import { Router } from "express";
import { Logger } from "winston";
import z from "zod/v4";
import { Services } from "../services/services.js";

export function buildWebserverRouter(
  services: Services,
  logger: Logger,
): Router {
  const router = Router();

  router.get("/app-config", async (_req, res) => {
    const appConfig = await services.dal.fetchCurrentAppConfig();
    res.status(200).json(appConfig);
  });

  router.patch("/app-config", async (req, res) => {
    const parsed = applyRawAppConfigRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).send(z.treeifyError(parsed.error));
      return;
    }
    const parsedYaml = appConfigSchema.strict().safeParse(parsed.data.yaml);
    if (!parsedYaml.success) {
      res.status(400).send(z.treeifyError(parsedYaml.error));
      return;
    }
    try {
      const result = await services.appConfig.update({
        payload: parsed.data.yaml,
      });
      res.status(202).send(result.data);
    } catch (e) {
      const error = loggableError(e);
      logger.error("Failed to update app config", {
        error,
        payload: parsed.data.yaml,
      });
      if (e instanceof AxiosError) {
        res.status(e.response?.status || 500).send({
          msg: e.response?.data.message || "Failed to update app config",
        });
      } else {
        res.status(500).send({
          msg: `Failed to update app config: ${error.errorMessage}`,
        });
      }
    }
  });

  router.post("/target-server", async (req, res) => {
    const parsed = createTargetServerRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).send(z.treeifyError(parsed.error));
      return;
    }
    const { data } = parsed;
    try {
      const result = await services.targetServers.create({
        payload: data,
      });
      res.status(202).send(result.data);
    } catch (e) {
      const error = loggableError(e);
      logger.error("Failed to create target server", {
        error,
        payload: req.body,
      });
      if (e instanceof AxiosError) {
        res.status(e.response?.status || 500).send({
          msg: e.response?.data.message || "Failed to create target server",
        });
      } else {
        res.status(500).send({
          msg: `Failed to create target server: ${error.errorMessage}`,
        });
      }
    }
  });

  router.patch("/target-server/:name", async (req, res) => {
    const name = req.params.name;
    const parsed = updateTargetServerRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).send(z.treeifyError(parsed.error));
      return;
    }
    const { data } = parsed;
    try {
      const result = await services.targetServers.update({
        name,
        payload: data,
      });
      res.status(202).send(result.data);
    } catch (e) {
      const error = loggableError(e);
      logger.error("Failed to update target server", {
        error,
        payload: req.body,
      });
      if (e instanceof AxiosError) {
        res.status(e.response?.status || 500).send({
          msg: e.response?.data.message || "Failed to update target server",
        });
      } else {
        res.status(500).send({
          msg: `Failed to update target server: ${error.errorMessage}`,
        });
      }
    }
  });

  router.delete("/target-server/:name", async (req, res) => {
    const name = req.params.name;

    try {
      await services.targetServers.delete({ name });
      res.status(204).send();
    } catch (e) {
      const error = loggableError(e);
      logger.error("Failed to delete target server", {
        error,
        name,
      });
      if (e instanceof AxiosError) {
        res.status(e.response?.status || 500).send({
          msg: e.response?.data.message || "Failed to delete target server",
        });
      } else {
        res.status(500).send({
          msg: `Failed to delete target server: ${error.errorMessage}`,
        });
      }
    }
  });

  return router;
}
