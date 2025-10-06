import z from "zod/v4";
import { setupConfigSchema, targetServerSchema } from "../shared/setup.js";

export const applyProfilePayloadSchema = z.object({
  profileId: z.string(),
  targetServers: z.record(z.string(), targetServerSchema),
  config: setupConfigSchema,
});
