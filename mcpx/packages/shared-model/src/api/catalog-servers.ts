import { z } from "zod/v4";
import { updateTargetServerRequestSchema } from "./request-schemas.js";

// ============ Config is an alias for TargetServer ============
// The currently used "TargetServer" object is actually an MCP server *config*.
// In order not to refactor the whole code but to connect to it,
// in the catalog I used "config" instead of "TargetServer" but *It's the same object* (see schema)
export const configSchema = z.record(
  z.string(),
  updateTargetServerRequestSchema,
);

// ============ GET request ============
export const catalogMCPServerSchema = z.object({
  name: z.string(),
  config: configSchema,
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

export type Config = z.infer<typeof configSchema>;
