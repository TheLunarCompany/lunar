import { z } from "zod/v4";
import { setupConfigSchema, targetServerSchema } from "../shared/setup.js";

// Ack response for save-setup
export const saveSetupAckSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    savedSetupId: z.uuid(),
    description: z.string(),
    savedAt: z.iso.datetime(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
]);

// Saved setup item in list response
export const savedSetupItemSchema = z.object({
  id: z.uuid(),
  description: z.string(),
  savedAt: z.iso.datetime(),
  targetServers: z.record(z.string(), targetServerSchema),
  config: setupConfigSchema.partial(),
});

// Ack response for list-saved-setups
export const listSavedSetupsAckSchema = z.object({
  setups: z.array(savedSetupItemSchema),
});

export const savedSetupErrorCodeSchema = z.enum([
  "not_found",
  "internal_error",
]);
export type SavedSetupErrorCode = z.infer<typeof savedSetupErrorCodeSchema>;

// Ack response for delete-saved-setup
export const deleteSavedSetupAckSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
    errorCode: savedSetupErrorCodeSchema.optional(),
  }),
]);

// Ack response for update-saved-setup
export const updateSavedSetupAckSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    savedAt: z.iso.datetime(),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
    errorCode: savedSetupErrorCodeSchema.optional(),
  }),
]);
