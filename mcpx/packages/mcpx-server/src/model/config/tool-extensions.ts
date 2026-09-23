import { ParamExtensionOverrideValue } from "@mcpx/shared-model/config";

export interface ToolExtensions {
  services: {
    [serviceName: string]: ServiceToolExtensions;
  };
}

export interface ServiceToolExtensions {
  [toolName: string]: {
    childTools: ToolExtension[];
  };
}

export interface ToolExtension {
  name: string;
  description?: ExtensionDescription;
  overrideParams: {
    [paramName: string]: {
      value?: ParamExtensionOverrideValue;
      description?: ExtensionDescription;
    };
  };
}

export interface ExtensionDescription {
  action: "append" | "rewrite";
  text: string;
}
