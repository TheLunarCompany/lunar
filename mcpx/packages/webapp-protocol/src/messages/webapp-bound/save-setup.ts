import { z } from "zod/v4";
import { setupDescriptionSchema } from "@mcpx/shared-model";
import { setupConfigSchema, targetServerEntrySchema } from "../shared/setup.js";

export const saveSetupPayloadSchema = z.object({
  targetServers: z.record(z.string(), targetServerEntrySchema),
  config: setupConfigSchema.partial(),
  description: setupDescriptionSchema,
});
