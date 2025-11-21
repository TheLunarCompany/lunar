import { NodeTypes, EdgeTypes } from "@xyflow/react";
import AgentNodeRenderer from "./AgentNodeRenderer";
import McpServerNodeRenderer from "./McpServerNodeRenderer";
import McpxNodeRenderer from "./McpxNodeRenderer";
import NoAgents from "./NoAgents";
import NoServers from "./NoServers";
import CustomCurvedEdge from "./CustomCurvedEdge";

export * from "./constants";

export const nodeTypes: NodeTypes = {
  mcpx: McpxNodeRenderer,
  mcpServer: McpServerNodeRenderer,
  agent: AgentNodeRenderer,
  noAgents: NoAgents,
  noServers: NoServers,
};

export const edgeTypes: EdgeTypes = {
  curved: CustomCurvedEdge,
};
