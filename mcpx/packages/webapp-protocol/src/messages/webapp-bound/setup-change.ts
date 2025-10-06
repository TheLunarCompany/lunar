import { z } from "zod/v4";
import { setupConfigSchema, targetServerSchema } from "../shared/setup.js";

export const setupChangePayloadSchema = z.object({
  source: z.enum(["user", "profile"]),
  targetServers: z.record(z.string(), targetServerSchema),
  config: setupConfigSchema,
});
