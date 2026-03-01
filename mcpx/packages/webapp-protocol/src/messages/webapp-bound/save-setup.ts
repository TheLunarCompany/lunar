import { z } from "zod/v4";
import { setupConfigSchema, targetServerSchema } from "../shared/setup.js";

export const saveSetupPayloadSchema = z.object({
  targetServers: z.record(z.string(), targetServerSchema),
  config: setupConfigSchema.partial(),
  description: z.string().min(1),
});
