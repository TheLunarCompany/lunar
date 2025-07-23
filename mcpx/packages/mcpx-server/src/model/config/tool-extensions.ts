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
  description?: ToolExtensionDescription;
  overrideParams: {
    [paramName: string]: ToolExtensionOverrideValue;
  };
}

export interface ToolExtensionDescription {
  action: "append" | "rewrite";
  text: string;
}

export type ToolExtensionOverrideValue =
  // null | undefined |
  string | number | boolean;
