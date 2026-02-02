import {
  GetIdentityResponse,
  getIdentityResponseSchema,
} from "@mcpx/shared-model";
import express, { Router } from "express";
import z from "zod/v4";
import { Services } from "../services/services.js";

export function buildIdentityRouter(
  authGuard: express.RequestHandler,
  services: Services,
): Router {
  const router = Router();

  // Public endpoint to get current identity
  // Used by UI to determine which features to show and which privileges to enable (e.g., admin nav)
  router.get("/", authGuard, (_req, res) => {
    const response: GetIdentityResponse = {
      identity: services.identityService.getIdentityForAPI(),
    };
    res.json(response satisfies z.infer<typeof getIdentityResponseSchema>);
  });

  return router;
}
