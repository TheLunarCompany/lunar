import z from "zod/v4";
import { catalogMCPServerSchema } from "@mcpx/shared-model";

// ============ Admin Config ============
// Admin-managed configuration that travels with catalog items.
// Contains settings like approved tools that mcpx-server translates into permissions.
export const catalogItemAdminConfigSchema = z.object({
  // Approved tools (allowlist). If present and non-empty, only these tools are allowed.
  approvedTools: z.array(z.string()),
});

// ============ Catalog Item Wire Format ============
// A catalog item as sent over the wire from hub to mcpx-server.
// Combines server initiation config with admin config.
export const catalogItemWireSchema = z.object({
  server: catalogMCPServerSchema,
  adminConfig: catalogItemAdminConfigSchema.optional(),
});

export const setCatalogPayloadSchema = z.object({
  items: z.array(catalogItemWireSchema),
});

// ============================================
// Type Exports
// ============================================

export type CatalogItemAdminConfig = z.infer<
  typeof catalogItemAdminConfigSchema
>;
export type CatalogItemWire = z.infer<typeof catalogItemWireSchema>;
