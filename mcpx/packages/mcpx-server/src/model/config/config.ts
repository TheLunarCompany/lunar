import { SkillsConfig, StaticOAuth, Permissions } from "@mcpx/shared-model";
import { ToolGroup } from "./permissions.js";
import { ToolExtensions } from "./tool-extensions.js";

export interface Config {
  permissions: Permissions;
  toolGroups: ToolGroup[];
  auth: {
    enabled: boolean;
    header?: string;
  };
  toolExtensions: ToolExtensions;
  targetServerAttributes: Record<string, TargetServerAttributes>;
  staticOauth?: StaticOAuth;
  skills: SkillsConfig;
}

export interface TargetServerAttributes {
  inactive: boolean;
}
