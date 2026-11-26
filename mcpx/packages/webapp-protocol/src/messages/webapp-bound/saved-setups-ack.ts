import { z } from "zod/v4";
import { webappBoundAckSchema } from "../shared/ack.js";
import { setupConfigSchema, targetServerEntrySchema } from "../shared/setup.js";

// Ack response for save-setup
export const saveSetupAckSchema = webappBoundAckSchema({
  savedSetupId: z.uuid(),
  description: z.string(),
  savedAt: z.iso.datetime(),
});

// Saved setup item in list response
export const savedSetupItemSchema = z.object({
  id: z.uuid(),
  description: z.string(),
  savedAt: z.iso.datetime(),
  targetServers: z.record(z.string(), targetServerEntrySchema),
  config: setupConfigSchema.partial(),
});

// Ack response for list-saved-setups
export const listSavedSetupsAckSchema = webappBoundAckSchema({
  setups: z.array(savedSetupItemSchema),
});

// Ack response for delete-saved-setup
export const deleteSavedSetupAckSchema = webappBoundAckSchema({});

// Ack response for update-saved-setup
export const updateSavedSetupAckSchema = webappBoundAckSchema({
  savedAt: z.iso.datetime(),
});
