import { Node } from "@xyflow/react";

export type McpxData = {
  forceSelected?: boolean;
  status: string;
};
export type McpxNode = Node<McpxData> & {
  type: "mcpx";
};

export type McpServerData = {
  args: string[];
  command: string;
  env: Record<string, string>;
  icon?: string;
  id: string;
  name: string;
  status: "connected_running" | "connected_stopped";
  tools: Array<{
    name: string;
    description?: string;
    invocations: number;
    lastCalledAt: Date;
  }>;
  configuration?: Record<string, any>;
  usage: {
    callCount: number;
    lastCalledAt: Date;
  };
};
export type McpServerNode = Node<McpServerData> & {
  type: "mcpServer";
};

export type AgentData = {
  id: string;
  identifier: string;
  status: "connected" | "disconnected";
  last_activity?: Date;
  sessionId?: string;
  llm?: {
    provider: string;
    model: string;
  };
  usage?: {
    callCount?: number;
    lastCalledAt?: Date;
  };
  access_config?: Record<string, any>;
  isSelected?: boolean;
};
export type AgentNode = Node<AgentData> & {
  type: "agent";
};

export type NoAgentsNode = Node & {
  type: "noAgents";
};
