export type Permission = "allow" | "block";
export type ToolGroupOwner = "user" | "dynamic-capabilities";
export interface ToolGroup {
  name: string;
  services: Record<string, ServiceToolGroup>;
  owner?: ToolGroupOwner;
}

export type ServiceToolGroup = string[] | "*";
