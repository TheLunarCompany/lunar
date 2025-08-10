import { NodeTypes } from "@xyflow/react";
import AgentNodeRenderer from "./AgentNodeRenderer";
import McpServerNodeRenderer from "./McpServerNodeRenderer";
import McpxNodeRenderer from "./McpxNodeRenderer";
import NoAgents from "./NoAgents";

export * from "./constants";

export const nodeTypes: NodeTypes = {
  mcpx: McpxNodeRenderer,
  mcpServer: McpServerNodeRenderer,
  agent: AgentNodeRenderer,
  noAgents: NoAgents,
};
