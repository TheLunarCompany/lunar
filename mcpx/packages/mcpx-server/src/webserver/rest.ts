import {
  ApplyAppConfigRequest,
  applyAppConfigRequestSchema,
  CreateTargetServerRequest,
  createTargetServerRequestSchema,
  GetAppConfigResponse,
  UpdateTargetServerRequest,
  updateTargetServerRequestSchema,
} from "@mcpx/shared-model/api";
import { Router } from "express";
import z from "zod/v4";

// TODO: implement routes' real logic
export function buildWebserverRouter(): Router {
  const router = Router();

  // Temporary in-memory storage for app config
  let configRaw = "config: patch-me";
  const targetServers: Record<string, UpdateTargetServerRequest> = {};

  router.get("/app-config", (_req, res) => {
    const appConfig: GetAppConfigResponse = { yaml: configRaw };
    res.status(200).json(appConfig);
  });

  router.patch("/app-config", (req, res) => {
    const parsed = applyAppConfigRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).send(z.treeifyError(parsed.error));
      return;
    }
    const { yaml }: ApplyAppConfigRequest = parsed.data;
    configRaw = yaml;
    const appConfig: GetAppConfigResponse = { yaml: configRaw };
    res.status(200).send(appConfig);
  });

  router.post("/target-server", (req, res) => {
    const parsed = createTargetServerRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).send(z.treeifyError(parsed.error));
      return;
    }
    const { name, command, args, env }: CreateTargetServerRequest = parsed.data;

    if (targetServers[name]) {
      res
        .status(409)
        .send({ msg: `Target server with name ${name} already exists` });
      return;
    }
    targetServers[name] = { command, args, env };
    res.status(201).send({ msg: `Target server ${name} created successfully` });
  });

  router.patch("/target-server/:name", (req, res) => {
    const name = req.params.name;
    const parsed = updateTargetServerRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).send(z.treeifyError(parsed.error));
      return;
    }

    if (!targetServers[name]) {
      res
        .status(404)
        .send({ msg: `Target server with name ${name} not found` });
      return;
    }
    targetServers[name] = parsed.data;
    res.status(200).send({ msg: `Target server ${name} updated successfully` });
  });

  return router;
}
