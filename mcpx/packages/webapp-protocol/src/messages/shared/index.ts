export {
  targetServerSchema,
  targetServerStdioSchema,
  targetServerSseSchema,
  targetServerStreamableHttpSchema,
  normalizedToolGroupSchema,
  setupConfigSchema,
  envValueSchema,
  type TargetServer,
  type EnvValue,
} from "./setup.js";

// Re-export schemas from shared-model for convenience
export {
  consumerConfigSchema,
  singleServerAttributesSchema,
  staticOAuthProviderSchema,
  staticOAuthSchema,
  toolExtensionSchema,
  toolExtensionsSchema,
  catalogMCPServerSchema,
  catalogMCPServerListSchema,
  catalogConfigSchema,
  catalogStdioConfigSchema,
  envRequirementSchema,
  envRequirementsSchema,
  type CatalogConfig,
  type CatalogMCPServerItem,
  type EnvRequirement,
  type EnvRequirements,
} from "@mcpx/shared-model";
