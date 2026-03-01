import z from "zod/v4";
import { setupConfigSchema, targetServerSchema } from "../shared/setup.js";

export const applySetupPayloadSchema = z.object({
  source: z.enum(["user", "profile"]),
  setupId: z.string(),
  targetServers: z.record(z.string(), targetServerSchema),
  config: setupConfigSchema.partial(),
});
