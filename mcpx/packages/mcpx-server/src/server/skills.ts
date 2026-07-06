import {
  Skill,
  SkillCatalogResponse,
  upsertSkillRequestSchema,
} from "@mcpx/shared-model";
import { loggableError } from "@mcpx/toolkit-core/logging";
import express, { Router } from "express";
import { Logger } from "winston";
import z from "zod/v4";
import { Services } from "../services/services.js";

export function buildSkillsRouter(
  authGuard: express.RequestHandler,
  services: Pick<Services, "skillStore">,
  logger: Logger,
): Router {
  const router = Router();

  router.get("/", authGuard, (_req, res) => {
    const { mine } = services.skillStore.getCatalog();
    res.status(200).json({ skills: mine } satisfies SkillCatalogResponse);
  });

  router.get("/:id", authGuard, (req, res) => {
    const id = req.params["id"];
    if (!id) {
      res.status(404).json({ message: "Skill not found" });
      return;
    }

    const skill = services.skillStore.getById(id);
    if (!skill) {
      res.status(404).json({ message: "Skill not found" });
      return;
    }

    res.status(200).json(skill satisfies Skill);
  });

  router.post("/", authGuard, async (req, res) => {
    const parsed = upsertSkillRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid request schema",
        error: z.treeifyError(parsed.error),
      });
      return;
    }

    try {
      const skill = await services.skillStore.createSkill(parsed.data);
      res.status(201).json(skill satisfies Skill);
    } catch (e) {
      logger.error("Error creating skill", { error: loggableError(e) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.put("/:id", authGuard, async (req, res) => {
    const id = req.params["id"];
    if (!id) {
      res.status(404).json({ message: "Skill not found" });
      return;
    }

    const existing = services.skillStore.getById(id);
    if (!existing) {
      res.status(404).json({ message: "Skill not found" });
      return;
    }

    const parsed = upsertSkillRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid request schema",
        error: z.treeifyError(parsed.error),
      });
      return;
    }

    try {
      const skill = await services.skillStore.updateSkill(
        existing.id,
        parsed.data,
      );
      res.status(200).json(skill satisfies Skill);
    } catch (e) {
      logger.error("Error updating skill", { error: loggableError(e) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.delete("/:id", authGuard, async (req, res) => {
    const id = req.params["id"];
    if (!id) {
      res.status(404).json({ message: "Skill not found" });
      return;
    }

    const skill = services.skillStore.getById(id);
    if (!skill) {
      res.status(404).json({ message: "Skill not found" });
      return;
    }

    try {
      await services.skillStore.deleteSkill(skill.id);
      res.status(204).send();
    } catch (e) {
      logger.error("Error deleting skill", { error: loggableError(e) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return router;
}
