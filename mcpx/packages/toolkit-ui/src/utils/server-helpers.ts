import { z } from "zod/v4";
import {
  inferServerTypeFromUrl,
  isValidJson,
  mcpJsonSchema,
  parseServerPayload,
  serverNameSchema,
  updateJsonWithServerType,
} from "./mcpJson";
import {
  AllowedCommands,
  createTargetServerRequestSchema,
  catalogMCPServerSchema,
  catalogConfigSchema,
  EnvRequirement,
  EnvValue,
} from "@mcpx/shared-model";

export const catalogMCPServerConfigByNameSchema = catalogMCPServerSchema
  .omit({ config: true })
  .extend({
    config: z.record(z.string(), catalogConfigSchema),
  });

export const catalogMCPServerArrayConfigByNameSchema = z.array(
  catalogMCPServerConfigByNameSchema,
);

export type CatalogMCPServerConfigByNameItem = z.infer<
  typeof catalogMCPServerConfigByNameSchema
>;
export type CatalogMCPServerConfigByNameList = z.infer<
  typeof catalogMCPServerArrayConfigByNameSchema
>;
export type TargetServerInput = z.input<typeof createTargetServerRequestSchema>;

export interface ServerValidationResult {
  success: boolean;
  error?: string;
  payload?: TargetServerInput;
  updatedJsonContent?: string;
}

export interface ServerValidationOptions {
  jsonContent: string;
  icon?: string;
  existingServers?: Array<{ name: string }>; // currently connected servers
  reservedNames?: Set<string>; // catalog servers names (or undefined on addition from catalog)
  isEdit?: boolean;
  originalServerName?: string;
}
const TABS = {
  ALL: "all" as const,
  CUSTOM: "custom" as const,
  MIGRATE: "migrate" as const,
} as const;
type TabValue = (typeof TABS)[keyof typeof TABS];

/**
 * Normalizes server names to lowercase and trimmed.
 * Used for case-insensitive server name matching across the system.
 */
export function normalizeServerName(name: string): string {
  return name.toLowerCase().trim();
}

export function getReservedServersNames(
  activeTab: TabValue,
  catalogItems: CatalogMCPServerConfigByNameList,
): Set<string> | undefined {
  return activeTab === TABS.CUSTOM || activeTab === TABS.MIGRATE
    ? mapCatalogItemsToNames(catalogItems)
    : undefined;
}

export function mapCatalogItemsToNames(
  catalogItems: CatalogMCPServerConfigByNameList,
): Set<string> {
  return new Set(catalogItems.map((s) => normalizeServerName(s.name)));
}
/**
 * Validates and processes server configuration for both add and edit operations
 * This centralizes all the common logic to avoid duplication between modals
 */
export const validateAndProcessServer = (
  options: ServerValidationOptions,
): ServerValidationResult => {
  const {
    jsonContent,
    icon,
    existingServers = [],
    reservedNames,
    isEdit = false,
    originalServerName,
  } = options;
  if (!jsonContent.trim().length) {
    return {
      success: false,
      error: "Missing MCP JSON configuration",
    };
  }

  if (!isValidJson(jsonContent)) {
    return {
      success: false,
      error: "Invalid JSON format",
    };
  }

  const json = JSON.parse(jsonContent);

  // Extract server name from JSON content
  const keys = Object.keys(json);
  if (keys.length !== 1) {
    return {
      success: false,
      error: "JSON must contain exactly one server definition.",
    };
  }

  const serverName = keys[0];
  if (!serverName) {
    return {
      success: false,
      error: "No server name found in JSON.",
    };
  }

  // Validate server name
  const parsedServerName = serverNameSchema.safeParse(serverName);
  if (parsedServerName.success === false) {
    return {
      success: false,
      error: `Server name "${serverName}" is invalid. Server name can only contain letters, numbers, dashes (-), and underscores (_).`,
    };
  }

  const mcpParseResult = mcpJsonSchema.safeParse(json);

  if (!mcpParseResult.success) {
    return {
      success: false,
      error: z.prettifyError(mcpParseResult.error),
    };
  }

  const parsed = mcpParseResult.data;

  // For edit operations, validate server name hasn't changed
  if (isEdit && originalServerName && serverName !== originalServerName) {
    return {
      success: false,
      error: `Server name cannot be changed. It must remain "${originalServerName}".`,
    };
  }

  if (!isEdit) {
    // Check for existing (currently connected) server (only for add operations)
    const normalizedName = normalizeServerName(serverName);
    const existingServer = existingServers.find(
      (server) => normalizeServerName(server.name) === normalizedName,
    );
    if (existingServer) {
      return {
        success: false,
        error: `Server with name "${serverName}" already exists. Please choose a different name.`,
      };
    }
    // Check for catalog server (only for custom add operations)
    if (reservedNames) {
      if (reservedNames.has(normalizedName)) {
        return {
          success: false,
          error: `Server with name "${serverName}" already in catalog. Use the catalog or change the server name`,
        };
      }
    }
  }

  // Get server config - it should exist after schema validation
  const serverConfig = parsed[serverName];
  if (!serverConfig) {
    return {
      success: false,
      error: `Server configuration not found for "${serverName}".`,
    };
  }

  // Create payload
  const payload = {
    ...serverConfig,
    icon,
    name: serverName,
  };

  if (payload.type === "http") {
    payload.type = "streamable-http";
  }

  // Ensure type is set
  if (!payload.type) {
    if ("url" in payload) {
      const inferredType = inferServerTypeFromUrl(payload.url);
      payload.type = inferredType || "sse";
    } else {
      payload.type = "stdio";
    }
  }

  // For API calls (add operations), we need to transform the data
  // For config file updates (edit operations), we keep the original format
  let apiPayload: TargetServerInput = payload as TargetServerInput;
  if (!isEdit) {
    // Use parseServerPayload for add operations to transform data for API
    const parseResult = parseServerPayload(payload);
    if (!parseResult.success) {
      return {
        success: false,
        error: z.prettifyError(parseResult.error),
      };
    }
    apiPayload = parseResult.data as TargetServerInput;
  }

  // Update JSON content to include the type for saving to config file
  const updatedJsonContent = updateJsonWithServerType(
    jsonContent,
    serverName,
    icon || "",
  );

  return {
    success: true,
    payload: apiPayload, // Send appropriate format based on operation
    updatedJsonContent,
  };
};

/**
 * Validates server name against default values
 */
export const validateServerName = (name: string): string | null => {
  const DEFAULT_SERVER_NAME = "my-server";

  if (name === DEFAULT_SERVER_NAME) {
    return `Server name cannot be "${DEFAULT_SERVER_NAME}". Please choose a different name.`;
  }

  return null;
};

/**
 * Validates server command against default values
 */
export const validateServerCommand = (payload: {
  type?: string;
  command?: string;
}): string | null => {
  if (
    !payload.type ||
    (payload.type === "stdio" &&
      !AllowedCommands.safeParse(payload.command).success)
  ) {
    const allowed = AllowedCommands.options.join(" | ");

    return `Command cannot be "${payload.command}". Please provide a valid command (${allowed}).`;
  }

  return null;
};

export interface MultipleServersResult {
  successfulServers: string[];
  failedServers: string[];
}

export interface MultipleServersOptions {
  serversObject: Record<string, unknown>;
  serverNames: string[];
  existingServers: Array<{ name: string }>;
  reservedNames?: Set<string>; // catalog servers names (or undefined on addition from catalog)
  getIcon: (name: string) => string | undefined;
  addServer: (
    payload: { payload: TargetServerInput },
    callbacks: {
      onSuccess: () => void;
      onError: () => void;
    },
  ) => void;
}

/**
 * Handles adding multiple servers in parallel
 * Validates all servers first, then adds valid ones simultaneously
 */
export const handleMultipleServers = async (
  options: MultipleServersOptions,
): Promise<MultipleServersResult> => {
  const {
    serversObject,
    serverNames,
    existingServers,
    reservedNames,
    getIcon,
    addServer,
  } = options;

  // Validate all servers first and prepare payloads
  const serverValidations = serverNames.map((serverName) => {
    const serverConfig = serversObject[serverName];
    const singleServerJson = JSON.stringify(
      { [serverName]: serverConfig },
      null,
      2,
    );

    const result = validateAndProcessServer({
      jsonContent: singleServerJson,
      icon: getIcon(serverName),
      existingServers: existingServers,
      reservedNames: reservedNames,
      isEdit: false,
    });

    if (!result.success || !result.payload) {
      return { serverName, error: result.error || "Validation failed" };
    }

    const nameError = validateServerName(serverName);
    if (nameError) {
      return { serverName, error: nameError };
    }

    const commandError = validateServerCommand(result.payload);
    if (commandError) {
      return { serverName, error: commandError };
    }

    return { serverName, payload: result.payload };
  });

  const validServers = serverValidations.filter(
    (v): v is { serverName: string; payload: TargetServerInput } =>
      "payload" in v,
  );
  const invalidServers = serverValidations.filter((v) => "error" in v);

  // If no valid servers, return early
  if (validServers.length === 0) {
    return {
      successfulServers: [],
      failedServers: invalidServers.map((s) => s.serverName),
    };
  }

  // Add all valid servers in parallel
  const addServerPromises = validServers.map(
    (server) =>
      new Promise<{ success: boolean; serverName: string }>((resolve) => {
        addServer(
          { payload: server.payload },
          {
            onSuccess: () =>
              resolve({ success: true, serverName: server.serverName }),
            onError: () =>
              resolve({ success: false, serverName: server.serverName }),
          },
        );
      }),
  );

  const results = await Promise.allSettled(addServerPromises);

  const successfulServers = results
    .filter((r) => r.status === "fulfilled" && r.value.success)
    .map((r) => (r.status === "fulfilled" ? r.value.serverName : ""));

  const failedServers = [
    ...invalidServers.map((s) => s.serverName),
    ...results
      .filter((r) => r.status === "fulfilled" && !r.value.success)
      .map((r) => (r.status === "fulfilled" ? r.value.serverName : "")),
    ...results.filter((r) => r.status === "rejected").map(() => "unknown"),
  ];

  return { successfulServers, failedServers };
};

// ============================================
// Helpers - EnvRequirement → Record<string, EnvValue> conversion
// ============================================

export function isEnvRequirement(
  value: EnvValue | EnvRequirement,
): value is EnvRequirement {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    (value.kind === "required" ||
      value.kind === "optional" ||
      value.kind === "fixed")
  );
}

export function convertRequirementsToValues(
  env: Record<string, EnvValue | EnvRequirement> | undefined,
): Record<string, EnvValue> {
  if (!env) {
    return {};
  }
  const result: Record<string, EnvValue> = {};
  for (const [key, value] of Object.entries(env)) {
    if (isEnvRequirement(value)) {
      if (value.kind === "fixed") {
        result[key] = value.prefilled;
      } else if (value.kind === "required") {
        result[key] = value.prefilled ?? "";
      } else if (value.kind === "optional") {
        result[key] = value.prefilled ?? null;
      }
    } else {
      // safeguard
      result[key] = value;
    }
  }
  return result;
}
