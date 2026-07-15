import type { PromptMessage, Tool } from "@modelcontextprotocol/sdk/types.js";
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
  selectionName?: string;
  description: string;
  providerName: string;
  isCustom?: boolean;
  originalToolName?: string;
  inputSchema?: Tool["inputSchema"];
  messages?: PromptMessage[];
  annotations?: ToolAnnotations;
  overrideParams?: ToolExtensionParamsRecord;
  unavailableReason?: string;
  estimatedTokens?: number;
  iconUrl?: string;
};

export type CapabilityProvider = {
  name: string;
  catalogItemId?: string;
  state?: TargetServerState;
  icon?: string;
  items: CapabilityItem[];
};

export type CapabilityGroupProviderSummary = {
  providerName: string;
  itemCount: number;
  toolCount: number;
  promptCount: number;
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
