import { AGENT_TYPES } from "./constants";

export type AgentType = keyof typeof AGENT_TYPES;

export interface McpServerExample {
  value: string;
  label: string;
  description: string;
  config: Record<string, any>;
  tools?: number;
  link?: string;
  doc?: string;
  icon?: string;
}