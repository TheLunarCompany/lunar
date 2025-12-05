import {
  consumerConfigSchema,
  ConsumerConfig,
  createPermissionConsumerRequestSchema,
  NewPermissions,
  newToolExtensionSchema,
  NewToolExtension,
  NewToolExtensionsMain,
  singleToolGroupSchema,
  ToolGroup,
} from "@mcpx/shared-model";
import { loggableError } from "@mcpx/toolkit-core/logging";
import express, { Router } from "express";
import { Logger } from "winston";
import z from "zod/v4";
import { env } from "../env.js";
import { AlreadyExistsError, NotFoundError } from "../errors.js";
import { Services } from "../services/services.js";

const toolGroupUpdateSchema = singleToolGroupSchema.omit({ name: true });

export function buildControlPlaneAppConfigRouter(
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

  // ==================== TOOL GROUPS ====================

  router.get("/tool-groups", authGuard, async (_req, res) => {
    const toolGroups = services.controlPlane.config.getToolGroups();
    res.status(200).json(toolGroups satisfies ToolGroup[]);
  });

  router.get("/tool-groups/:name", authGuard, async (req, res) => {
    const name = req.params["name"];
    if (!name) {
      res.status(400).json({ message: "Tool group name is required" });
      return;
    }

    const toolGroup = services.controlPlane.config.getToolGroup({ name });
    if (!toolGroup) {
      res.status(404).json({ message: `Tool group '${name}' not found` });
      return;
    }

    res.status(200).json(toolGroup satisfies ToolGroup);
  });

  router.post("/tool-groups", authGuard, async (req, res) => {
    const parsed = singleToolGroupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid request schema",
        error: z.treeifyError(parsed.error),
      });
      return;
    }

    try {
      const toolGroup = await services.controlPlane.config.addToolGroup({
        group: parsed.data,
      });
      res.status(201).json(toolGroup satisfies ToolGroup);
    } catch (e) {
      if (e instanceof AlreadyExistsError) {
        res.status(409).json({ message: e.message, error: loggableError(e) });
        return;
      }
      logger.error("Error adding tool group", { error: loggableError(e) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.put("/tool-groups/:name", authGuard, async (req, res) => {
    const name = req.params["name"];
    if (!name) {
      res.status(400).json({ message: "Tool group name is required" });
      return;
    }

    const parsed = toolGroupUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid request schema",
        error: z.treeifyError(parsed.error),
      });
      return;
    }

    try {
      const toolGroup = await services.controlPlane.config.updateToolGroup({
        name,
        updates: parsed.data,
      });
      res.status(200).json(toolGroup satisfies ToolGroup);
    } catch (e) {
      if (e instanceof NotFoundError) {
        res.status(404).json({ message: e.message, error: loggableError(e) });
        return;
      }
      logger.error("Error updating tool group", { error: loggableError(e) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.delete("/tool-groups/:name", authGuard, async (req, res) => {
    const name = req.params["name"];
    if (!name) {
      res.status(400).json({ message: "Tool group name is required" });
      return;
    }

    try {
      await services.controlPlane.config.deleteToolGroup({ name });
      res.status(200).json({ message: `Tool group '${name}' deleted` });
    } catch (e) {
      if (e instanceof NotFoundError) {
        res.status(404).json({ message: e.message, error: loggableError(e) });
        return;
      }
      logger.error("Error deleting tool group", { error: loggableError(e) });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ==================== TOOL EXTENSIONS ====================

  const toolExtensionUpdateSchema = newToolExtensionSchema.omit({ name: true });

  router.get("/tool-extensions", authGuard, async (_req, res) => {
    const extensions = services.controlPlane.config.getToolExtensions();
    res.status(200).json(extensions satisfies NewToolExtensionsMain);
  });

  router.get(
    "/tool-extensions/:serverName/:originalToolName/:customToolName",
    authGuard,
    async (req, res) => {
      const { serverName, originalToolName, customToolName } = req.params;
      if (!serverName || !originalToolName || !customToolName) {
        res.status(400).json({ message: "All path parameters are required" });
        return;
      }

      const extension = services.controlPlane.config.getToolExtension({
        serverName,
        originalToolName,
        customToolName,
      });
      if (!extension) {
        res.status(404).json({
          message: `Tool extension '${customToolName}' not found for ${serverName}/${originalToolName}`,
        });
        return;
      }

      res.status(200).json(extension satisfies NewToolExtension);
    },
  );

  router.post(
    "/tool-extensions/:serverName/:originalToolName",
    authGuard,
    async (req, res) => {
      const { serverName, originalToolName } = req.params;
      if (!serverName || !originalToolName) {
        res.status(400).json({ message: "All path parameters are required" });
        return;
      }

      const parsed = newToolExtensionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          message: "Invalid request schema",
          error: z.treeifyError(parsed.error),
        });
        return;
      }

      try {
        const extension = await services.controlPlane.config.addToolExtension({
          serverName,
          originalToolName,
          extension: parsed.data,
        });
        res.status(201).json(extension satisfies NewToolExtension);
      } catch (e) {
        if (e instanceof AlreadyExistsError) {
          res.status(409).json({ message: e.message, error: loggableError(e) });
          return;
        }
        logger.error("Error adding tool extension", {
          error: loggableError(e),
        });
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  router.put(
    "/tool-extensions/:serverName/:originalToolName/:customToolName",
    authGuard,
    async (req, res) => {
      const { serverName, originalToolName, customToolName } = req.params;
      if (!serverName || !originalToolName || !customToolName) {
        res.status(400).json({ message: "All path parameters are required" });
        return;
      }

      const parsed = toolExtensionUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          message: "Invalid request schema",
          error: z.treeifyError(parsed.error),
        });
        return;
      }

      try {
        const extension =
          await services.controlPlane.config.updateToolExtension({
            serverName,
            originalToolName,
            customToolName,
            updates: parsed.data,
          });
        res.status(200).json(extension satisfies NewToolExtension);
      } catch (e) {
        if (e instanceof NotFoundError) {
          res.status(404).json({ message: e.message, error: loggableError(e) });
          return;
        }
        logger.error("Error updating tool extension", {
          error: loggableError(e),
        });
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  router.delete(
    "/tool-extensions/:serverName/:originalToolName/:customToolName",
    authGuard,
    async (req, res) => {
      const { serverName, originalToolName, customToolName } = req.params;
      if (!serverName || !originalToolName || !customToolName) {
        res.status(400).json({ message: "All path parameters are required" });
        return;
      }

      try {
        await services.controlPlane.config.deleteToolExtension({
          serverName,
          originalToolName,
          customToolName,
        });
        res.status(200).json({
          message: `Tool extension '${customToolName}' deleted from ${serverName}/${originalToolName}`,
        });
      } catch (e) {
        if (e instanceof NotFoundError) {
          res.status(404).json({ message: e.message, error: loggableError(e) });
          return;
        }
        logger.error("Error deleting tool extension", {
          error: loggableError(e),
        });
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  // ==================== PERMISSIONS ====================

  router.get("/permissions", authGuard, async (_req, res) => {
    const permissions = services.controlPlane.config.getPermissions();
    res.status(200).json(permissions satisfies NewPermissions);
  });

  router.get("/permissions/default", authGuard, async (_req, res) => {
    const defaultPermission =
      services.controlPlane.config.getDefaultPermission();
    res.status(200).json(defaultPermission satisfies ConsumerConfig);
  });

  router.get("/permissions/consumers", authGuard, async (_req, res) => {
    const consumers = services.controlPlane.config.getPermissionConsumers();
    res.status(200).json(consumers satisfies Record<string, ConsumerConfig>);
  });

  router.get(
    "/permissions/consumers/:consumerName",
    authGuard,
    async (req, res) => {
      const name = req.params["consumerName"];
      if (!name) {
        res.status(400).json({ message: "Consumer name is required" });
        return;
      }

      const consumer = services.controlPlane.config.getPermissionConsumer({
        name,
      });
      if (!consumer) {
        res
          .status(404)
          .json({ message: `Permission consumer '${name}' not found` });
        return;
      }

      res.status(200).json(consumer satisfies ConsumerConfig);
    },
  );

  router.post("/permissions/consumers", authGuard, async (req, res) => {
    const parsed = createPermissionConsumerRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid request schema",
        error: z.treeifyError(parsed.error),
      });
      return;
    }

    try {
      const consumer = await services.controlPlane.config.addPermissionConsumer(
        {
          name: parsed.data.name,
          config: parsed.data.config,
        },
      );
      res.status(201).json(consumer satisfies ConsumerConfig);
    } catch (e) {
      if (e instanceof AlreadyExistsError) {
        res.status(409).json({ message: e.message, error: loggableError(e) });
        return;
      }
      logger.error("Error adding permission consumer", {
        error: loggableError(e),
      });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.put("/permissions/default", authGuard, async (req, res) => {
    const parsed = consumerConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid request schema",
        error: z.treeifyError(parsed.error),
      });
      return;
    }

    try {
      const defaultPermission =
        await services.controlPlane.config.updateDefaultPermission({
          config: parsed.data,
        });
      res.status(200).json(defaultPermission satisfies ConsumerConfig);
    } catch (e) {
      logger.error("Error updating default permission", {
        error: loggableError(e),
      });
      res.status(500).json({ message: "Internal server error" });
    }
  });

  router.put(
    "/permissions/consumers/:consumerName",
    authGuard,
    async (req, res) => {
      const name = req.params["consumerName"];
      if (!name) {
        res.status(400).json({ message: "Consumer name is required" });
        return;
      }

      const parsed = consumerConfigSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          message: "Invalid request schema",
          error: z.treeifyError(parsed.error),
        });
        return;
      }

      try {
        const consumer =
          await services.controlPlane.config.updatePermissionConsumer({
            name,
            config: parsed.data,
          });
        res.status(200).json(consumer satisfies ConsumerConfig);
      } catch (e) {
        if (e instanceof NotFoundError) {
          res.status(404).json({ message: e.message, error: loggableError(e) });
          return;
        }
        logger.error("Error updating permission consumer", {
          error: loggableError(e),
        });
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  router.delete(
    "/permissions/consumers/:consumerName",
    authGuard,
    async (req, res) => {
      const name = req.params["consumerName"];
      if (!name) {
        res.status(400).json({ message: "Consumer name is required" });
        return;
      }

      try {
        await services.controlPlane.config.deletePermissionConsumer({ name });
        res
          .status(200)
          .json({ message: `Permission consumer '${name}' deleted` });
      } catch (e) {
        if (e instanceof NotFoundError) {
          res.status(404).json({ message: e.message, error: loggableError(e) });
          return;
        }
        logger.error("Error deleting permission consumer", {
          error: loggableError(e),
        });
        res.status(500).json({ message: "Internal server error" });
      }
    },
  );

  // ==================== SERVER ATTRIBUTES ====================

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

  return router;
}
