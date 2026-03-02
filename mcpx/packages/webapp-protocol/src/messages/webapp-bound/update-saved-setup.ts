import { z } from "zod/v4";
import { setupConfigSchema, targetServerSchema } from "../shared/setup.js";

export const updateSavedSetupPayloadSchema = z.object({
  savedSetupId: z.string().uuid(),
  targetServers: z.record(z.string(), targetServerSchema),
  config: setupConfigSchema.partial(),
});
