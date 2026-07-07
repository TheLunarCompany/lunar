import {
  EnabledSkillsResponse,
  scopeSubjectSchema,
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
  services: Pick<Services, "skills" | "controlPlane">,
  logger: Logger,
): Router {
  const router = Router();

  router.get("/", authGuard, (_req, res) => {
    const { mine } = services.skills.store.getCatalog();
    res.status(200).json({ skills: mine } satisfies SkillCatalogResponse);
  });

  // Registered before /:id so the literal path isn't captured as an id.
  router.get("/enabled", authGuard, (_req, res) => {
    const enabled = services.controlPlane.config.getEnabledSkills();
    res.status(200).json({ enabled } satisfies EnabledSkillsResponse);
  });

  router.get("/:id", authGuard, (req, res) => {
    const id = req.params["id"];
    if (!id) {
      res.status(404).json({ message: "Skill not found" });
      return;
    }

    const skill = services.skills.store.getById(id);
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
      const skill = await services.skills.store.createSkill(parsed.data);
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

    const existing = services.skills.store.getById(id);
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
      const skill = await services.skills.store.updateSkill(
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

    const skill = services.skills.store.getById(id);
    if (!skill) {
      res.status(404).json({ message: "Skill not found" });
      return;
    }

    try {
      await services.skills.store.deleteSkill(skill.id);
      res.status(204).send();
    } catch (e) {
      logger.error("Error deleting skill", { error: loggableError(e) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Idempotent per-subject enablement of one skill. `:kind` is not free text:
  // scopeSubjectSchema forces it to "consumerTag" | "clientName"; anything
  // else answers 400.
  router.put("/:id/enabled/:kind/:value", authGuard, async (req, res) => {
    const id = req.params["id"];
    const skill = id ? services.skills.store.getById(id) : undefined;
    if (!skill) {
      res.status(404).json({ message: "Skill not found" });
      return;
    }

    const subject = scopeSubjectSchema.safeParse({
      kind: req.params["kind"],
      value: req.params["value"],
    });
    if (!subject.success) {
      res.status(400).json({
        message: "Invalid subject",
        error: z.treeifyError(subject.error),
      });
      return;
    }

    try {
      await services.controlPlane.config.enableSkill({
        subject: subject.data,
        skillId: skill.id,
      });
      res.status(204).send();
    } catch (e) {
      logger.error("Error enabling skill", { error: loggableError(e) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // No skill-existence check: disable stays usable for cleaning a row whose
  // skill was already deleted.
  router.delete("/:id/enabled/:kind/:value", authGuard, async (req, res) => {
    const id = req.params["id"];
    if (!id) {
      res.status(404).json({ message: "Skill not found" });
      return;
    }

    const subject = scopeSubjectSchema.safeParse({
      kind: req.params["kind"],
      value: req.params["value"],
    });
    if (!subject.success) {
      res.status(400).json({
        message: "Invalid subject",
        error: z.treeifyError(subject.error),
      });
      return;
    }

    try {
      await services.controlPlane.config.disableSkill({
        subject: subject.data,
        skillId: id,
      });
      res.status(204).send();
    } catch (e) {
      logger.error("Error disabling skill", { error: loggableError(e) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return router;
}
