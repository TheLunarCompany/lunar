import { z } from "zod/v4";
import { updateTargetServerRequestSchema } from "./request-schemas.js";

// ============ GET request ============
export const catalogMCPServerSchema = z.object({
  name: z.string(),
  config: updateTargetServerRequestSchema,
  displayName: z.string(),
  description: z.string().optional(),
  link: z.string().optional(),
  iconPath: z.string().optional(),
  doc: z.string().optional(),
});

export const catalogMCPServerListSchema = z.array(catalogMCPServerSchema);

// ============================================
// Type Exports
// ============================================

export type CatalogMCPServerInput = z.input<typeof catalogMCPServerSchema>;
export type CatalogMCPServerItem = z.infer<typeof catalogMCPServerSchema>;
export type CatalogMCPServerList = z.infer<typeof catalogMCPServerListSchema>;
