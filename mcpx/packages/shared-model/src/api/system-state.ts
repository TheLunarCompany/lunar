import type {
  Prompt,
  PromptMessage,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod/v4";

// Currently, describe the state of the system - for a single MCPX instance
export interface SystemState {
  targetServers: TargetServer[];
  connectedClients: ConnectedClient[];
  connectedClientClusters: ConnectedClientCluster[];
  usage: Usage;
  lastUpdatedAt: Date;
  configError?: string; // Error message if configuration validation failed
  mcpxVersion?: string; // MCPX server version from Docker/container
}

export type MissingEnvVar =
  | { key: string; type: "literal" }
  | { key: string; type: "fromEnv"; fromEnvName: string };

export type TargetServerState =
  | { type: "connecting" }
  | { type: "connected" }
  | { type: "pending-auth" }
  | { type: "pending-input"; missingEnvVars: MissingEnvVar[] }
  | { type: "connection-failed"; error?: Error };

export type EnvValue =
  | string
  | { fromEnv: string }
  | { fromSecret: string }
  | null;
export interface StdioTargetServer {
  _type: "stdio";
  state: TargetServerState;
  name: string;
  catalogItemId?: string;
  command: string;
  args?: string[];
  env?: Record<string, EnvValue>;
  icon?: string;
  tools: TargetServerTool[];
  originalTools: Tool[];
  prompts?: TargetServerPrompt[];
  originalPrompts?: Prompt[];
  usage: Usage;
}

interface RemoteTargetServer {
  state: TargetServerState;
  name: string;
  catalogItemId?: string;
  url: string;
  headers?: Record<string, EnvValue>;
  icon?: string;
  tools: TargetServerTool[];
  originalTools: Tool[];
  prompts?: TargetServerPrompt[];
  originalPrompts?: Prompt[];
  usage: Usage;
}

export type SSETargetServer = RemoteTargetServer & { _type: "sse" };
export type StreamableHTTPTargetServer = RemoteTargetServer & {
  _type: "streamable-http";
};

export type TargetServer =
  | StdioTargetServer
  | SSETargetServer
  | StreamableHTTPTargetServer;
export const usageSchema = z.object({
  callCount: z.number(),
  lastCalledAt: z.date().optional(),
});
export type Usage = z.infer<typeof usageSchema>;

export const visibleToolSchema = z.object({
  serverName: z.string(),
  toolName: z.string(),
});
export type VisibleTool = z.infer<typeof visibleToolSchema>;

export const connectedClientAdapterSchema = z.object({
  // essentially a union type, right now we only recognize mcp-remote
  name: z.literal("mcp-remote"),
  version: z
    .object({
      major: z.number(),
      minor: z.number(),
      patch: z.number(),
      prerelease: z.array(z.union([z.string(), z.number()])),
      build: z.array(z.union([z.string(), z.number()])),
    })
    .optional(),
  support: z
    .object({
      ping: z.boolean(),
    })
    .optional(),
});
export type ConnectedClientAdapter = z.infer<
  typeof connectedClientAdapterSchema
>;

export const connectedClientInfoSchema = z.object({
  protocolVersion: z.string().optional(),
  name: z.string().optional(),
  version: z.string().optional(),
  adapter: connectedClientAdapterSchema.optional(),
});
export type ConnectedClientInfo = z.infer<typeof connectedClientInfoSchema>;

// Connection health and presence for the dashboard, as a single axis:
// - "connected": live and responsive.
// - "unresponsive": live but missing pings (the staleness signal), not yet reaped.
// - "disconnected": not live. Set when a session ends at runtime (transport
//   closed or errored, or an idle-TTL / ping-timeout reap) or when a persisted
//   session is surfaced after an MCPX restart or hibernation. Kept visible for
//   the retention window, or until the same session id reconnects.
export const connectionStateSchema = z.enum([
  "connected",
  "unresponsive",
  "disconnected",
]);
export type ConnectionState = z.infer<typeof connectionStateSchema>;

export const connectedClientSchema = z.object({
  sessionId: z.string(),
  clientId: z.string(), // Stable unique identifier for the agent
  usage: usageSchema,
  consumerTag: z.string().optional(),
  llm: z
    .object({
      provider: z.string().optional(),
      modelId: z.string().optional(),
    })
    .optional(),
  clientInfo: connectedClientInfoSchema.optional(),
  // Per-session live fields.
  dynamicMode: z.boolean(),
  visibleTools: z.array(visibleToolSchema),
  lastSeenAt: z.number().optional(),
  // Health/presence on one axis (see connectionStateSchema). Replaces a separate
  // `unresponsive` boolean so there is a single source of truth for the UI.
  connectionState: connectionStateSchema,
  // Epoch ms the session went disconnected. Set only for offline agents.
  disconnectedAt: z.number().optional(),
});
export type ConnectedClient = z.infer<typeof connectedClientSchema>;

export interface ConsumerTagCluster {
  identityType: "consumerTag";
  consumerTag: string;
  clientNames: string[];
  sessionIds: string[];
  usage: Usage;
}

export interface ClientNameCluster {
  identityType: "clientName";
  clientName: string;
  sessionIds: string[];
  usage: Usage;
}

export interface AnonymousCluster {
  identityType: "anonymous";
  sessionIds: string[];
  usage: Usage;
}

export type ConnectedClientCluster =
  | ConsumerTagCluster
  | ClientNameCluster
  | AnonymousCluster;

export interface TargetServerTool {
  name: string;
  usage: Usage;
  inputSchema: Tool["inputSchema"];
  description?: string;
  estimatedTokens?: number;
  parameters?: TargetServerToolParameter[];
  annotations?: Tool["annotations"];
}

export interface TargetServerToolParameter {
  name: string;
  description?: string;
}

export interface TargetServerPrompt {
  name: string;
  description?: string;
  arguments?: TargetServerPromptArgument[];
  messages?: PromptMessage[];
  usage: Usage;
}

export interface TargetServerPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}
