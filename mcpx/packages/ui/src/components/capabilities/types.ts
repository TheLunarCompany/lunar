import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type {
  TargetServerState,
  ToolExtensionParamsRecord,
} from "@mcpx/shared-model";
import type { ToolAnnotations } from "@/types";

export type CapabilityKind = "tool" | "prompt";

export type CapabilityItem = {
  id: string;
  kind: CapabilityKind;
  name: string;
  description: string;
  providerName: string;
  isCustom?: boolean;
  originalToolName?: string;
  inputSchema?: Tool["inputSchema"];
  annotations?: ToolAnnotations;
  overrideParams?: ToolExtensionParamsRecord;
};

export type CapabilityProvider = {
  name: string;
  state?: TargetServerState;
  icon?: string;
  items: CapabilityItem[];
};

export type CapabilityGroupProviderSummary = {
  providerName: string;
  itemCount: number;
  itemNames: string[];
  selectionKeys: CapabilitySelectionKey[];
  isWildcard?: boolean;
};

export type CapabilityGroup = {
  id: string;
  name: string;
  description: string;
  providers: CapabilityGroupProviderSummary[];
  services: Record<string, string[] | "*">;
};

export type CapabilitySelectionKey = `${string}:${string}`;

export type CapabilityAnnotationFilterValue =
  | "read-only"
  | "write"
  | "destructive";
