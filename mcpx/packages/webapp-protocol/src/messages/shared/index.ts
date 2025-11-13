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
  newToolExtensionSchema,
  newToolExtensionsMainSchema,
  staticOAuthProviderSchema,
  staticOAuthSchema,
} from "@mcpx/shared-model";
