import z from "zod/v4";
import { catalogMCPServerListSchema } from "@mcpx/shared-model";
export const setCatalogPayloadSchema = z.object({
  servers: catalogMCPServerListSchema,
});
