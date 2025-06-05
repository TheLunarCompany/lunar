import {
  ApplyAppConfigRequest,
  applyAppConfigRequestSchema,
  createTargetServerRequestSchema,
  GetAppConfigResponse,
  updateTargetServerRequestSchema,
} from "@mcpx/shared-model/api";
import { Router } from "express";
import z from "zod/v4";
import { webserverLogger } from "../logger.js";
import { Services } from "../services/services.js";
import { ConfigManager } from "../config.js";
import { parse, stringify } from "yaml";
import { configSchema } from "../model.js";
import {
  AlreadyExistsError,
  FailedToConnectToTargetServer,
  NotFoundError,
} from "../errors.js";
import { loggableError } from "../utils/logging.js";

export function buildWebserverRouter(
  config: ConfigManager,
  services: Services,
): Router {
  const router = Router();

  router.get("/app-config", (_req, res) => {
    const appConfig: GetAppConfigResponse = {
      yaml: stringify(config.getConfig()),
      version: config.getVersion(),
      lastModified: config.getLastModified(),
    };
    res.status(200).json(appConfig);
  });

  router.patch("/app-config", (req, res) => {
    // This endpoint works in two schema validation layers:
    // 1. It makes sure the request body is valid YAML under the `yaml` field.
    // 2. It parses and validates the YAML against the config schema.
    const parsedRequest = applyAppConfigRequestSchema.safeParse(req.body);
    if (!parsedRequest.success) {
      res.status(400).send(z.treeifyError(parsedRequest.error));
      return;
    }
    const { yaml }: ApplyAppConfigRequest = parsedRequest.data;
    const obj = parse(yaml);
    if (!obj) {
      res.status(400).send({ msg: "Invalid YAML format" });
      return;
    }
    const parsedConfig = configSchema
      .pick({ permissions: true, toolGroups: true })
      .safeParse(obj);
    if (!parsedConfig.success) {
      res.status(400).send(z.treeifyError(parsedConfig.error));
      return;
    }
    config.updateConfig(parsedConfig.data);

    const appConfig: GetAppConfigResponse = {
      yaml: stringify(config.getConfig()),
      version: config.getVersion(),
      lastModified: config.getLastModified(),
    };
    res.status(200).send(appConfig);
  });

  router.post("/target-server", async (req, res) => {
    const parsed = createTargetServerRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).send(z.treeifyError(parsed.error));
      return;
    }
    const { data } = parsed;

    try {
      await services.targetClients.addClient(data);
      await services.sessions.shutdown();
      res.status(201).send({ msg: `Target server ${data.name} created` });
    } catch (e: unknown) {
      if (e instanceof FailedToConnectToTargetServer) {
        res.status(400).send({
          msg: `Failed to connect to target server ${data.name}: ${e.message}`,
        });
        return;
      }
      if (e instanceof AlreadyExistsError) {
        res
          .status(409)
          .send({ msg: `Target server ${data.name} already exists` });
        return;
      }
      const error = loggableError(e);
      webserverLogger.error("Error creating target server", { error, data });
      res.status(500).send({ msg: `Error creating target server: ${error}` });
    }
  });

  router.patch("/target-server/:name", async (req, res) => {
    const name = req.params.name;
    const existingTargetServer = services.targetClients.getTargetServer(name);
    if (!existingTargetServer) {
      res
        .status(404)
        .send({ msg: `Target server ${name} not found`, config: true });
      return;
    }
    const parsed = updateTargetServerRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).send(z.treeifyError(parsed.error));
      return;
    }

    const { data } = parsed;
    try {
      await services.targetClients.removeClient(name);
      await services.targetClients.addClient({ ...data, name });
      await services.sessions.shutdown();
      res.status(200).send({ msg: `Target server ${name} updated` });
    } catch (e: unknown) {
      if (e instanceof FailedToConnectToTargetServer) {
        await services.targetClients.addClient(existingTargetServer);
        res.status(400).send({
          msg: `Failed to connect to target server ${name}: ${e.message}`,
        });
        return;
      }
      // Ensure we don't leave the target server in an inconsistent state

      if (e instanceof NotFoundError) {
        res.status(404).send({ msg: `Target server ${name} not found` });
        return;
      }
      const error = loggableError(e);
      webserverLogger.error("Error updating target server", {
        error,
        name,
        data,
      });
      res.status(500).send({ msg: `Error updating target server: ${error}` });
      return;
    }
  });

  router.delete("/target-server/:name", async (req, res) => {
    const name = req.params.name;
    try {
      await services.targetClients.removeClient(name);
      await services.sessions.shutdown();
      res.status(200).send({ msg: `Target server ${name} removed` });
    } catch (e: unknown) {
      if (e instanceof NotFoundError) {
        res.status(404).send({ msg: `Target server ${name} not found` });
        return;
      }
      const error = loggableError(e);
      webserverLogger.error("Error removing target server", { error, name });
      res.status(500).send({ msg: `Error removing target server: ${error}` });
    }
  });

  return router;
}
