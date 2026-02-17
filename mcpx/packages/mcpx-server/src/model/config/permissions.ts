export type Permission = "allow" | "block";

export interface PermissionsConfig {
  default: ConsumerConfig;
  consumers: Record<string, ConsumerConfig>;
}

export type ConsumerConfig =
  | DefaultAllowConsumerConfig
  | DefaultBlockConsumerConfig;

export interface DefaultAllowConsumerConfig {
  _type?: "default-allow";
  consumerGroupKey?: string; // e.g. "claude-desktop"
  block: string[];
}

export interface DefaultBlockConsumerConfig {
  _type?: "default-block";
  consumerGroupKey?: string; // e.g. "claude-desktop"
  allow: string[];
}

export type ToolGroupOwner = "user" | "dynamic-capabilities";

export interface ToolGroup {
  name: string;
  services: Record<string, ServiceToolGroup>;
  owner?: ToolGroupOwner;
}

export type ServiceToolGroup = string[] | "*";
