import { Tool } from "@modelcontextprotocol/sdk/types.js";

// Currently, describe the state of the system - for a single MCPX instance
export interface SystemState {
  targetServers: TargetServer[]; // @deprecated - use targetServers_new instead
  targetServers_new: TargetServerNew[];
  connectedClients: ConnectedClient[];
  usage: Usage;
  lastUpdatedAt: Date;
  configError?: string; // Error message if configuration validation failed
}

//@deprecated - use TargetServerNew instead
export interface TargetServer {
  args?: string; // Space-separated arguments for the command
  command: string;
  env?: string; // JSON stringified environment variables
  icon?: string;
  name: string;
  tools: TargetServerTool[];
  originalTools: Tool[];
  usage: Usage;
}

export type TargetServerState =
  | { type: "connected" }
  | { type: "pending-auth" }
  | { type: "connection-failed"; error?: Error };

export interface StdioTargetServer {
  _type: "stdio";
  state: TargetServerState;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  icon?: string;
  tools: TargetServerTool[];
  originalTools: Tool[];
  usage: Usage;
}

interface RemoteTargetServer {
  state: TargetServerState;
  name: string;
  url: string;
  icon?: string;
  tools: TargetServerTool[];
  originalTools: Tool[];
  usage: Usage;
}

export type SSETargetServer = RemoteTargetServer & { _type: "sse" };
export type StreamableHTTPTargetServer = RemoteTargetServer & {
  _type: "streamable-http";
};

export type TargetServerNew =
  | StdioTargetServer
  | SSETargetServer
  | StreamableHTTPTargetServer;

export interface ConnectedClient {
  sessionId: string;
  clientId: string; // Stable unique identifier for the agent
  usage: Usage;
  consumerTag?: string;
  llm?: {
    provider?: string;
    modelId?: string;
  };
}

export interface TargetServerTool {
  name: string;
  usage: Usage;
  inputSchema: Tool["inputSchema"];
  description?: string;
}

export interface Usage {
  callCount: number;
  lastCalledAt?: Date;
}
