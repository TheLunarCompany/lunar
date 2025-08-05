import { PermissionsConfig, ToolGroup } from "./permissions.js";
import { ToolExtensions } from "./tool-extensions.js";

export interface Config {
  permissions: PermissionsConfig;
  toolGroups: ToolGroup[];
  auth: {
    enabled: boolean;
    header?: string;
  };
  toolExtensions: ToolExtensions;
}
