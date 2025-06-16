import {
  ApplyRawAppConfigRequest,
  applyRawAppConfigRequestSchema,
  createTargetServerRequestSchema,
  updateTargetServerRequestSchema,
  WebserverToMCPXMessage,
} from "@mcpx/shared-model/api";
import { Router } from "express";
import { parse } from "yaml";
import z from "zod/v4";
import { Services } from "../services/services.js";

export function buildWebserverRouter(services: Services): Router {
  const router = Router();

  router.get("/app-config", async (_req, res) => {
    const appConfig = await services.dal.fetchCurrentAppConfig();
    res.status(200).json(appConfig);
  });

  router.patch("/app-config", (req, res) => {
    const parsedRequest = applyRawAppConfigRequestSchema.safeParse(req.body);
    if (!parsedRequest.success) {
      res.status(400).send(z.treeifyError(parsedRequest.error));
      return;
    }
    const { yaml }: ApplyRawAppConfigRequest = parsedRequest.data;
    // TODO: leave on mcpx only?
    const obj = parse(yaml);
    if (!obj) {
      res.status(400).send({ msg: "Invalid YAML format" });
      return;
    }

    services.hub.send({
      name: WebserverToMCPXMessage.PatchAppConfig,
      payload: { obj },
    });

    // TODO: Return updated config data
    res.status(202).send({ msg: "Request accepted" });
  });

  router.post("/target-server", async (req, res) => {
    const parsed = createTargetServerRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).send(z.treeifyError(parsed.error));
      return;
    }
    const { data } = parsed;

    services.hub.send({
      name: WebserverToMCPXMessage.AddTargetServer,
      payload: data,
    });
    res.status(202).send({ msg: "Request accepted" });
  });

  router.patch("/target-server/:name", async (req, res) => {
    const name = req.params.name;
    const parsed = updateTargetServerRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).send(z.treeifyError(parsed.error));
      return;
    }

    const { data } = parsed;
    services.hub.send({
      name: WebserverToMCPXMessage.UpdateTargetServer,
      payload: { ...data, name },
    });

    // TODO: Return updated server data
    res.status(202).send({ msg: "Request accepted" });
  });

  router.delete("/target-server/:name", async (req, res) => {
    const name = req.params.name;

    services.hub.send({
      name: WebserverToMCPXMessage.RemoveTargetServer,
      payload: { name },
    });

    res.status(202).send({ msg: "Request accepted" });
  });

  return router;
}
