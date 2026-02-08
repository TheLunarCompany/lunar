import z from "zod/v4";
import { authSchema } from "../config/config.js";
import {
  permissionsSchema,
  staticOAuthSchema,
  targetServerAttributesSchema,
  toolExtensionsSchema,
} from "../config/next-version.js";
import { updateTargetServerRequestSchema } from "./request-schemas.js";

// Normalized tool group schema (where `*` is expanded to explicit array of tools)
// Different from toolGroupSchema which allows z.literal("*")
export const normalizedToolGroupSchema = z.array(
  z.object({
    name: z.string(),
    description: z.string().optional(),
    services: z.record(z.string(), z.array(z.string())),
  }),
);

// Setup config schema for saved setups (uses normalized tool groups)
export const savedSetupConfigSchema = z.object({
  permissions: permissionsSchema,
  toolGroups: normalizedToolGroupSchema,
  auth: authSchema,
  toolExtensions: toolExtensionsSchema,
  targetServerAttributes: targetServerAttributesSchema,
  staticOauth: staticOAuthSchema,
});

// Saved setup item
export const savedSetupItemSchema = z.object({
  id: z.string().uuid(),
  description: z.string(),
  savedAt: z.string().datetime(),
  targetServers: z.record(z.string(), updateTargetServerRequestSchema),
  config: savedSetupConfigSchema.partial(),
});

export type SavedSetupItem = z.infer<typeof savedSetupItemSchema>;

// REST API response schemas
export const listSavedSetupsResponseSchema = z.object({
  setups: z.array(savedSetupItemSchema),
});

export type ListSavedSetupsResponse = z.infer<
  typeof listSavedSetupsResponseSchema
>;

export const saveSetupSuccessResponseSchema = z.object({
  success: z.literal(true),
  savedSetupId: z.string().uuid(),
  description: z.string(),
  savedAt: z.string().datetime(),
});

export const saveSetupErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

export const saveSetupResponseSchema = z.discriminatedUnion("success", [
  saveSetupSuccessResponseSchema,
  saveSetupErrorResponseSchema,
]);

export type SaveSetupResponse = z.infer<typeof saveSetupResponseSchema>;

export const messageResponseSchema = z.object({
  message: z.string(),
});

export type MessageResponse = z.infer<typeof messageResponseSchema>;
