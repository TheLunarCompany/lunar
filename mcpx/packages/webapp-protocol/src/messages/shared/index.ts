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
  newToolExtensionSchema,
  newToolExtensionsMainSchema,
  singleServerAttributesSchema,
  staticOAuthProviderSchema,
  staticOAuthSchema,
} from "@mcpx/shared-model";
