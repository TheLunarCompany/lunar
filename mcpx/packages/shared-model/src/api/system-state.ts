// Currently, describe the state of the system - for a single MCPX instance
export interface SystemState {
  targetServers: TargetServer[];
  connectedClients: ConnectedClient[];
  usage: Usage;
  lastUpdatedAt: Date;
}

export interface TargetServer {
  name: string;
  tools: TargetServerTool[];
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
}

export interface Usage {
  callCount: number;
  lastCalledAt?: Date;
}
