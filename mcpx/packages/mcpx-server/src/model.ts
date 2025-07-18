import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Tool as McpTool } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod/v4";

// Internal models for the MCPX server.
// Shared models should be placed in the `shared-model` package.

export interface TargetServersConfig {
  servers: Record<string, RawServerData>;
}

interface RawServerData {
  address: string;
}

export const targetServerStdioSchema = z.object({
  type: z.literal("stdio").default("stdio"),
  command: z.string(),
  args: z.array(z.string()).optional().default([]),
  env: z.record(z.string(), z.string()).optional().default({}),
  icon: z.string().optional(),
});

export const targetServerSseSchema = z.object({
  type: z.literal("sse"),
  url: z.string(),
});

export const targetServerStreamableHttpSchema = z.object({
  type: z.literal("streamable-http"),
  url: z.string(),
});

export const targetServerSchema = z.union([
  targetServerStdioSchema,
  targetServerSseSchema,
  targetServerStreamableHttpSchema,
]);

export const createTargetServerSchema = targetServerSchema.and(
  z.object({ name: z.string() }),
);

export const targetServerConfigSchema = z.object({
  mcpServers: z.record(z.string(), targetServerSchema).optional().default({}),
});

export type ServerName = { name: string };
export type StdioTargetServer = z.infer<typeof targetServerStdioSchema> &
  ServerName;
export type SSETargetServer = z.infer<typeof targetServerSseSchema> &
  ServerName;
export type StreamableHttpTargetServer = z.infer<
  typeof targetServerStreamableHttpSchema
> &
  ServerName;
export type RemoteTargetServer = SSETargetServer | StreamableHttpTargetServer;
export type TargetServer =
  | SSETargetServer
  | StreamableHttpTargetServer
  | StdioTargetServer;

export type Tool = Pick<McpTool, "description" | "inputSchema" | "name"> & {};

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
    clientInfo?: {
      protocolVersion?: string;
      name?: string;
      version?: string;
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
  consumerGroupKey?: string; // e.g. "claude-desktop"
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
  services: {
    [serviceName: string]: ServiceToolExtensions;
  };
}

export interface ServiceToolExtensions {
  [toolName: string]: {
    childTools: ToolExtension[];
  };
}

export interface ToolExtension {
  name: string;
  description?: ToolExtensionDescription;
  overrideParams: {
    [paramName: string]: ToolExtensionOverrideValue;
  };
}

export interface ToolExtensionDescription {
  action: "append" | "rewrite";
  text: string;
}

export type ToolExtensionOverrideValue =
  // null | undefined |
  string | number | boolean;
