import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ValidateFunction } from "ajv";
import Ajv from "ajv";
import type { ConsumerConfig } from "@mcpx/shared-model";
import { consumerConfigSchema } from "@mcpx/shared-model";
import type { JsonObject, JsonSchemaType, JsonValue } from "./jsonUtils";

const ajv = new Ajv();

// Cache for compiled validators
const toolOutputValidators = new Map<string, ValidateFunction>();

/**
 * Compiles and caches output schema validators for a list of tools
 * Following the same pattern as SDK's Client.cacheToolOutputSchemas
 * @param tools Array of tools that may have output schemas
 */
export function cacheToolOutputSchemas(tools: Tool[]): void {
  toolOutputValidators.clear();
  for (const tool of tools) {
    if (tool.outputSchema) {
      try {
        const validator = ajv.compile(tool.outputSchema);
        toolOutputValidators.set(tool.name, validator);
      } catch (error) {
        console.warn(
          `Failed to compile output schema for tool ${tool.name}:`,
          error,
        );
      }
    }
  }
}

/**
 * Gets the cached output schema validator for a tool
 * Following the same pattern as SDK's Client.getToolOutputValidator
 * @param toolName Name of the tool
 * @returns The compiled validator function, or undefined if not found
 */
export function getToolOutputValidator(
  toolName: string,
): ValidateFunction | undefined {
  return toolOutputValidators.get(toolName);
}

/**
 * Validates structured content against a tool's output schema
 * Returns validation result with detailed error messages
 * @param toolName Name of the tool
 * @param structuredContent The structured content to validate
 * @returns An object with isValid boolean and optional error message
 */
export function validateToolOutput(
  toolName: string,
  structuredContent: unknown,
): { isValid: boolean; error?: string } {
  const validator = getToolOutputValidator(toolName);
  if (!validator) {
    return { isValid: true }; // No validator means no schema to validate against
  }

  const isValid = validator(structuredContent);
  if (!isValid) {
    return {
      isValid: false,
      error: ajv.errorsText(validator.errors),
    };
  }

  return { isValid: true };
}

/**
 * Checks if a tool has an output schema
 * @param toolName Name of the tool
 * @returns true if the tool has an output schema
 */
export function hasOutputSchema(toolName: string): boolean {
  return toolOutputValidators.has(toolName);
}

/**
 * Generates a default value based on a JSON schema type
 * @param schema The JSON schema definition
 * @param propertyName Optional property name for checking if it's required in parent schema
 * @param parentSchema Optional parent schema to check required array
 * @returns A default value matching the schema type
 */
export function generateDefaultValue(
  schema: JsonSchemaType,
  propertyName?: string,
  parentSchema?: JsonSchemaType,
): JsonValue {
  if ("default" in schema && schema.default !== undefined) {
    return schema.default;
  }

  // Check if this property is required in the parent schema
  const isRequired =
    propertyName && parentSchema
      ? isPropertyRequired(propertyName, parentSchema)
      : false;

  switch (schema.type) {
    case "string":
      return isRequired ? "" : undefined;
    case "number":
    case "integer":
      return isRequired ? 0 : undefined;
    case "boolean":
      return isRequired ? false : undefined;
    case "array":
      return [];
    case "object": {
      if (!schema.properties) return {};

      const obj: JsonObject = {};
      // Only include properties that are required according to the schema's required array
      Object.entries(schema.properties).forEach(([key, prop]) => {
        if (isPropertyRequired(key, schema)) {
          const value = generateDefaultValue(prop, key, schema);
          if (value !== undefined) {
            obj[key] = value;
          }
        }
      });
      return obj;
    }
    case "null":
      return null;
    default:
      return undefined;
  }
}

/**
 * Helper function to check if a property is required in a schema
 * @param propertyName The name of the property to check
 * @param schema The parent schema containing the required array
 * @returns true if the property is required, false otherwise
 */
export function isPropertyRequired(
  propertyName: string,
  schema: JsonSchemaType,
): boolean {
  return schema.required?.includes(propertyName) ?? false;
}

/**
 * Formats a field key into a human-readable label
 * @param key The field key to format
 * @returns A formatted label string
 */
export function formatFieldLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1") // Insert space before capital letters
    .replace(/_/g, " ") // Replace underscores with spaces
    .replace(/^\w/, (c) => c.toUpperCase()); // Capitalize first letter
}

/**
 * Normalizes a consumer config by filtering out invalid array elements
 * Removes null/undefined values from block and allow arrays
 * @param config The consumer config to normalize
 * @returns A normalized consumer config object
 */
export function normalizeConsumerConfig(
  config: unknown,
): Record<string, unknown> {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    return config as Record<string, unknown>;
  }

  const obj = config as Record<string, unknown>;
  return {
    ...obj,
    block: Array.isArray(obj.block)
      ? obj.block.filter(
          (v: unknown) =>
            v !== null && v !== undefined && typeof v === "string",
        )
      : obj.block,
    allow: Array.isArray(obj.allow)
      ? obj.allow.filter(
          (v: unknown) =>
            v !== null && v !== undefined && typeof v === "string",
        )
      : obj.allow,
  };
}

/**
 * Validates a consumer config and returns the validated config or throws an error
 * @param config The consumer config to validate
 * @param consumerName Optional consumer name for error messages
 * @returns The validated consumer config
 * @throws Error if validation fails
 */
export function validateConsumerConfig(
  config: unknown,
  consumerName?: string,
): ConsumerConfig {
  const normalized = normalizeConsumerConfig(config);
  const result = consumerConfigSchema.safeParse(normalized);

  if (!result.success) {
    const errorMessage = consumerName
      ? `Invalid consumer config for ${consumerName}`
      : "Invalid consumer config";
    const issues = result.error.issues
      .map((issue) => issue.message)
      .join(", ");

    console.error(errorMessage + ":", result.error.issues, config);
    throw new Error(`${errorMessage}: ${issues}`);
  }

  return result.data;
}

/**
 * Safely validates a consumer config and returns a result object
 * Does not throw, useful for filtering invalid configs
 * @param config The consumer config to validate
 * @param consumerName Optional consumer name for logging
 * @returns An object with success status and validated config or error details
 */
export function safeValidateConsumerConfig(
  config: unknown,
  consumerName?: string,
): {
  success: boolean;
  data?: ConsumerConfig;
  error?: {
    issues: Array<{ path: string[]; message: string }>;
    originalData: unknown;
  };
} {
  const normalized = normalizeConsumerConfig(config);
  const result = consumerConfigSchema.safeParse(normalized);

  if (!result.success) {
    const name = consumerName ? `"${consumerName}"` : "unknown";
    console.warn(
      `Skipping invalid consumer config for ${name}:`,
      result.error.issues,
      "Original data:",
      config,
    );

    return {
      success: false,
      error: {
        issues: result.error.issues.map((issue) => ({
          path: issue.path.map(String),
          message: issue.message,
        })),
        originalData: config,
      },
    };
  }

  return {
    success: true,
    data: result.data,
  };
}
