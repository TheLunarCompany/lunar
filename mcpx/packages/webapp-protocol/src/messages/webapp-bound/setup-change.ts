import { z } from "zod/v4";
import { setupConfigSchema, targetServerEntrySchema } from "../shared/setup.js";

export const setupChangePayloadSchema = z.object({
  source: z.enum(["user", "hub"]),
  targetServers: z.record(z.string(), targetServerEntrySchema),
  config: setupConfigSchema.partial(),
});
