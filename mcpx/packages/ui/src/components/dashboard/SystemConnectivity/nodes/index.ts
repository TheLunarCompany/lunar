import { EdgeTypes, NodeTypes } from "@xyflow/react";
import AgentNodeRenderer from "./AgentNodeRenderer";
import McpServerNodeRenderer from "./McpServerNodeRenderer";
import McpxNodeRenderer from "./McpxNodeRenderer";
import NoAgents from "./NoAgents";
import NoServers from "./NoServers";
import AddButtonNode from "./AddButtonNode";
import CustomCurvedEdge from "./CustomCurvedEdge";

export * from "./constants";

export const nodeTypes: NodeTypes = {
  mcpx: McpxNodeRenderer,
  mcpServer: McpServerNodeRenderer,
  agent: AgentNodeRenderer,
  noAgents: NoAgents,
  noServers: NoServers,
  addButton: AddButtonNode,
};

export const edgeTypes: EdgeTypes = {
  curved: CustomCurvedEdge,
};
