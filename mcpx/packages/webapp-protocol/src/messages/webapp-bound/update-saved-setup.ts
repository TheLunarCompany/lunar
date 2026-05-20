import { z } from "zod/v4";
import { setupConfigSchema, targetServerEntrySchema } from "../shared/setup.js";

export const updateSavedSetupPayloadSchema = z.object({
  savedSetupId: z.string().uuid(),
  targetServers: z.record(z.string(), targetServerEntrySchema),
  config: setupConfigSchema.partial(),
});
