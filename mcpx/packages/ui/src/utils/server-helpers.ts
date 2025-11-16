import { z } from "zod/v4";
import {
  isValidJson,
  mcpJsonSchema,
  parseServerPayload,
  serverNameSchema,
  updateJsonWithServerType,
  inferServerTypeFromUrl,
} from "./mcpJson";
import type { TargetServerInput } from "@/data/mcp-server";

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
  const updatedJsonContent = updateJsonWithServerType(jsonContent, serverName, icon || "");

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

export interface MultipleServersResult {
  successfulServers: string[];
  failedServers: string[];
}

export interface MultipleServersOptions {
  serversObject: Record<string, unknown>;
  serverNames: string[];
  existingServers: unknown[];
  getIcon: (name: string) => string | undefined;
  addServer: (
    payload: { payload: TargetServerInput },
    callbacks: {
      onSuccess: () => void;
      onError: () => void;
    }
  ) => void;
}

/**
 * Handles adding multiple servers in parallel
 * Validates all servers first, then adds valid ones simultaneously
 */
export const handleMultipleServers = async (
  options: MultipleServersOptions
): Promise<MultipleServersResult> => {
  const { serversObject, serverNames, existingServers, getIcon, addServer } = options;

  // Validate all servers first and prepare payloads
  const serverValidations = serverNames.map((serverName) => {
    const serverConfig = serversObject[serverName];
    const singleServerJson = JSON.stringify({ [serverName]: serverConfig }, null, 2);

    const result = validateAndProcessServer({
      jsonContent: singleServerJson,
      icon: getIcon(serverName),
      existingServers,
      isEdit: false,
    });

    if (result.success === false) {
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

  const validServers = serverValidations.filter((v) => 'payload' in v);
  const invalidServers = serverValidations.filter((v) => 'error' in v);

  // If no valid servers, return early
  if (validServers.length === 0) {
    return {
      successfulServers: [],
      failedServers: invalidServers.map(s => s.serverName),
    };
  }

  // Add all valid servers in parallel
  const addServerPromises = validServers.map((server) =>
    new Promise<{ success: boolean; serverName: string }>((resolve) => {
      addServer(
        { payload: server.payload },
        {
          onSuccess: () => resolve({ success: true, serverName: server.serverName }),
          onError: () => resolve({ success: false, serverName: server.serverName }),
        },
      );
    })
  );

  const results = await Promise.allSettled(addServerPromises);
  
  const successfulServers = results
    .filter((r) => r.status === 'fulfilled' && r.value.success)
    .map((r) => r.status === 'fulfilled' ? r.value.serverName : '');
  
  const failedServers = [
    ...invalidServers.map(s => s.serverName),
    ...results
      .filter((r) => r.status === 'fulfilled' && !r.value.success)
      .map((r) => r.status === 'fulfilled' ? r.value.serverName : ''),
    ...results
      .filter((r) => r.status === 'rejected')
      .map(() => 'unknown'),
  ];

  return { successfulServers, failedServers };
};
