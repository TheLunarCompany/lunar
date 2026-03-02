import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { ToolExtensionParamsRecord } from "@mcpx/shared-model";

export type ToolDetails = {
  description: string;
  name: string;
  originalToolName?: string;
  serviceName: string;
  params?: Array<{
    description: string;
    name: string;
    type: string;
  }>;
  overrideParams?: ToolExtensionParamsRecord;
};

export type ToolsItem = {
  description?: {
    text: string;
    action: "append" | "rewrite";
  };
  name: string;
  originalToolId?: string;
  originalToolName?: string;
  serviceName: string;
  inputSchema?: Tool["inputSchema"];
  overrideParams?: ToolExtensionParamsRecord;
  isCustom?: boolean;
};
