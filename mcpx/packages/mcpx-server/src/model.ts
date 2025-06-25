import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod/v4";

// Internal models for the MCPX server.
// Shared models should be placed in the `shared-model` package.

export interface TargetServersConfig {
  servers: Record<string, RawServerData>;
}

interface RawServerData {
  address: string;
}

export const targetServerSchema = z.object({
  args: z.array(z.string()).optional().default([]),
  command: z.string(),
  env: z.record(z.string(), z.string()).optional().default({}),
  icon: z.string().optional(),
});

export const targetServerConfigSchema = z.object({
  mcpServers: z.record(z.string(), targetServerSchema).optional().default({}),
});

export type TargetServerConfig = z.infer<typeof targetServerSchema>;
export type TargetServer = TargetServerConfig & { name: string };

export type Tool = {
  name: string;
  inputSchema: {
    type: "object";
    properties?: unknown;
  } & { [k: string]: unknown };
  description?: string | undefined;
};

export const messageSchema = z.object({
  method: z.string(),
  params: z
    .object({
      name: z.string().optional(),
      arguments: z.record(z.string(), z.any()).optional(),
    })
    .optional(),
});

export interface McpxSession {
  transport:
    | { type: "sse"; transport: SSEServerTransport }
    | { type: "streamableHttp"; transport: StreamableHTTPServerTransport };
  consumerConfig: ConsumerConfig | undefined | null; // undefined if not searched yet, null if not found
  metadata: {
    consumerTag?: string;
    llm?: {
      provider?: string;
      modelId?: string;
    };
  };
}

// Permissions
export type Permission = "allow" | "block";

// Config
export interface Config {
  permissions: PermissionsConfig;
  toolGroups: ToolGroup[];
  auth: {
    enabled: boolean;
    header?: string;
  };
  toolExtensions: ToolExtensions;
}

export interface PermissionsConfig {
  base: Permission;
  consumers: Record<string, ConsumerConfig>;
}

export interface ConsumerConfig {
  base?: Permission;
  profiles?: {
    allow?: string[];
    block?: string[];
  };
}

export interface ToolGroup {
  name: string;
  services: Record<string, ServiceToolGroup>;
}

export type ServiceToolGroup = string[] | "*";

export interface ToolExtensions {
  services: Record<string, ServiceToolExtensions>;
}

export interface ServiceToolExtensions {
  [toolName: string]: {
    childTools: ToolExtension[];
  };
}

export interface ToolExtension {
  name: string;
  description?: ToolExtensionDescription;
  overrideParams: Record<string, ToolExtensionOverrideValue>;
}

export interface ToolExtensionDescription {
  action: "append" | "rewrite";
  text: string;
}

export type ToolExtensionOverrideValue = string | number | boolean;
