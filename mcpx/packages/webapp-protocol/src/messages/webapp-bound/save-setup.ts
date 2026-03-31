import { z } from "zod/v4";
import { setupConfigSchema, targetServerEntrySchema } from "../shared/setup.js";

export const saveSetupPayloadSchema = z.object({
  targetServers: z.record(z.string(), targetServerEntrySchema),
  config: setupConfigSchema.partial(),
  description: z.string().min(1),
});
