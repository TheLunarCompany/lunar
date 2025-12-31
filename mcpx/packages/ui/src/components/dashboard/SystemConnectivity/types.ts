import { Agent, McpServer } from "@/types";
import { Node } from "@xyflow/react";

export type McpxData = {
  status: string;
  version?: string;
};
export type McpxNode = Node<McpxData> & {
  type: "mcpx";
};

export type McpServerNode = Node<McpServer> & {
  type: "mcpServer";
};

export type AgentNode = Node<Agent> & {
  type: "agent";
};

export type NoAgentsNode = Node & {
  type: "noAgents";
};

export type NoServersNode = Node & {
  type: "noServers";
};
