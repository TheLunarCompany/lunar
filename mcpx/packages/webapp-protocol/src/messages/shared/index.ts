export {
  targetServerSchema,
  targetServerStdioSchema,
  targetServerSseSchema,
  targetServerStreamableHttpSchema,
  normalizedToolGroupSchema,
  setupConfigSchema,
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
} from "@mcpx/shared-model";
