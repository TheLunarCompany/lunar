import z from "zod/v4";
import { catalogMCPServerSchema } from "@mcpx/shared-model";

// Admin-only "watermark" header MCPX injects into requests to remote servers, so the
// server can verify the request came through MCPX. Never exposed in any user-facing API.
// `.min(1)` enforces both fields or neither.
export const privateHeadersSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
});
export type PrivateHeaders = z.infer<typeof privateHeadersSchema>;

// ============ Admin Config ============
// Admin-managed configuration that travels with catalog items.
// Contains settings like approved tools that mcpx-server translates into permissions.
export const catalogItemAdminConfigSchema = z.object({
  // Approved tools (allowlist).
  // Can be undefined, probably because no Sandbox Analysis was run so admin couldn't set any.
  approvedTools: z.array(z.string()).optional(),
  // Admin-only headers injected into requests to remote servers (see privateHeadersSchema).
  privateHeaders: privateHeadersSchema.optional(),
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
