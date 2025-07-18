import { Tool } from "@modelcontextprotocol/sdk/types.js";

// Currently, describe the state of the system - for a single MCPX instance
export interface SystemState {
  targetServers: TargetServer[];
  connectedClients: ConnectedClient[];
  usage: Usage;
  lastUpdatedAt: Date;
}

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

export interface ConnectedClient {
  sessionId: string;
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
  description?: string;
  inputSchema?: Tool["inputSchema"];
}

export interface Usage {
  callCount: number;
  lastCalledAt?: Date;
}
