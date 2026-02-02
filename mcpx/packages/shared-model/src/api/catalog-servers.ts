import { z } from "zod/v4";
import { AllowedCommands, envRequirementsSchema } from "./request-schemas.js";

// ============ Catalog Config Schemas ============
// These are separate from request schemas - catalog configs are templates
// that define what servers look like + what env vars users need to provide.
// Request schemas are what users send to create/update servers.

export const catalogStdioConfigSchema = z.object({
  type: z.literal("stdio"),
  command: AllowedCommands,
  args: z.array(z.string()).default([]),
  env: envRequirementsSchema.optional(),
  icon: z.string().optional(),
});

export const catalogSseConfigSchema = z.object({
  type: z.literal("sse"),
  url: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  icon: z.string().optional(),
});

export const catalogStreamableHttpConfigSchema = z.object({
  type: z.literal("streamable-http"),
  url: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
  icon: z.string().optional(),
});

export const catalogConfigSchema = z.discriminatedUnion("type", [
  catalogStdioConfigSchema,
  catalogSseConfigSchema,
  catalogStreamableHttpConfigSchema,
]);

// ============ Catalog Server Schema ============
export const catalogMCPServerSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  config: catalogConfigSchema,
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

export type CatalogStdioConfig = z.infer<typeof catalogStdioConfigSchema>;
export type CatalogSseConfig = z.infer<typeof catalogSseConfigSchema>;
export type CatalogStreamableHttpConfig = z.infer<
  typeof catalogStreamableHttpConfigSchema
>;
export type CatalogConfig = z.infer<typeof catalogConfigSchema>;
export type CatalogMCPServerInput = z.input<typeof catalogMCPServerSchema>;
export type CatalogMCPServerItem = z.infer<typeof catalogMCPServerSchema>;
export type CatalogMCPServerList = z.infer<typeof catalogMCPServerListSchema>;
