import { z } from "zod/v4";
import {
  isValidJson,
  mcpJsonSchema,
  parseServerPayload,
  serverNameSchema,
  updateJsonWithServerType,
  inferServerTypeFromUrl,
} from "./mcpJson";

export interface ServerValidationResult {
  success: boolean;
  error?: string;
  payload?: any;
  updatedJsonContent?: string;
}

export interface ServerValidationOptions {
  jsonContent: string;
  icon?: string;
  existingServers?: any[];
  isEdit?: boolean;
  originalServerName?: string;
}

/**
 * Validates and processes server configuration for both add and edit operations
 * This centralizes all the common logic to avoid duplication between modals
 */
export const validateAndProcessServer = (options: ServerValidationOptions): ServerValidationResult => {
  const {
    jsonContent,
    icon,
    existingServers = [],
    isEdit = false,
    originalServerName
  } = options;
  if (!jsonContent.trim().length) {
    return {
      success: false,
      error: "Missing MCP JSON configuration"
    };
  }

  if (!isValidJson(jsonContent)) {
    return {
      success: false,
      error: "Invalid JSON format"
    };
  }

  const json = JSON.parse(jsonContent);
  
  // Extract server name from JSON content
  const keys = Object.keys(json);
  if (keys.length !== 1) {
    return {
      success: false,
      error: "JSON must contain exactly one server definition."
    };
  }
  
  const serverName = keys[0];
  
  // Validate server name
  let parsedServerName = serverNameSchema.safeParse(serverName);
  if (parsedServerName.success === false) {
    return {
      success: false,
      error: `Server name "${serverName}" is invalid. Server name can only contain letters, numbers, dashes (-), and underscores (_).`
    };
  }

  const mcpParseResult = mcpJsonSchema.safeParse(json);
  
  if (!mcpParseResult.success) {
    return {
      success: false,
      error: z.prettifyError(mcpParseResult.error)
    };
  }

  const parsed = mcpParseResult.data;

  // For edit operations, validate server name hasn't changed
  if (isEdit && originalServerName && serverName !== originalServerName) {
    return {
      success: false,
      error: `Server name cannot be changed. It must remain "${originalServerName}".`
    };
  }

  // Check for existing server (only for add operations)
  if (!isEdit) {
    const existingServer = existingServers.find(
      (server: any) => server.name === serverName
    );
    if (existingServer) {
      return {
        success: false,
        error: `Server with name "${serverName}" already exists. Please choose a different name.`
      };
    }
  }

  // Create payload
  const payload = {
    ...parsed[serverName],
    icon,
    name: serverName,
  };

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
  let apiPayload: any = payload;
  if (!isEdit) {
    // Use parseServerPayload for add operations to transform data for API
    const parseResult = parseServerPayload(payload);
    if (!parseResult.success) {
      return {
        success: false,
        error: z.prettifyError(parseResult.error)
      };
    }
    apiPayload = parseResult.data;
  }

  // Update JSON content to include the type for saving to config file
  const updatedJsonContent = updateJsonWithServerType(jsonContent, serverName, icon);

  return {
    success: true,
    payload: apiPayload, // Send appropriate format based on operation
    updatedJsonContent
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
export const validateServerCommand = (payload: any): string | null => {
  const DEFAULT_SERVER_COMMAND = "my-command";
  
  if (
    !payload.type ||
    (payload.type === "stdio" && payload.command === DEFAULT_SERVER_COMMAND)
  ) {
    return `Command cannot be "${DEFAULT_SERVER_COMMAND}". Please provide a valid command.`;
  }
  
  return null;
};
