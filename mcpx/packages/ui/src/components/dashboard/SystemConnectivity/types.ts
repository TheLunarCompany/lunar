import { Node } from "@xyflow/react";

export type McpxData = {
  selected: boolean;
  status: string;
};
export type McpxNode = Node<McpxData> & {
  type: "mcpx";
};

export type McpServerData = {
  args: string[];
  command: string;
  configuration?: Record<string, any>;
  env: Record<string, string>;
  icon?: string;
  id: string;
  name: string;
  selected: boolean;
  status: "connected_running" | "connected_stopped";
  tools: Array<{
    name: string;
    description?: string;
    invocations: number;
    lastCalledAt: Date;
  }>;
  usage: {
    callCount: number;
    lastCalledAt: Date;
  };
};
export type McpServerNode = Node<McpServerData> & {
  type: "mcpServer";
};

export type AgentData = {
  access_config?: Record<string, any>;
  id: string;
  identifier: string;
  last_activity?: Date;
  llm?: {
    provider: string;
    model: string;
  };
  selected: boolean;
  sessionId?: string;
  status: "connected" | "disconnected";
  usage?: {
    callCount?: number;
    lastCalledAt?: Date;
  };
};
export type AgentNode = Node<AgentData> & {
  type: "agent";
};

export type NoAgentsNode = Node & {
  type: "noAgents";
};
