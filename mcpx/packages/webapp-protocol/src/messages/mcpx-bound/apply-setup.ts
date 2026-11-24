import z from "zod/v4";
import { setupConfigSchema, targetServerEntrySchema } from "../shared/setup.js";

export const applySetupPayloadSchema = z.object({
  setupId: z.string(),
  targetServers: z.record(z.string(), targetServerEntrySchema),
  config: setupConfigSchema.partial(),
});
