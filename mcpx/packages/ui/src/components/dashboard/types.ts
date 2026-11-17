import { AGENT_TYPES } from "./constants";

export type AgentType = keyof typeof AGENT_TYPES;

export interface McpServerExample {
  value: string;
  label: string;
  description: string;
  config: Record<string, unknown>;
  tools?: number;
  link?: string;
  doc?: string;
  icon?: string;
}

// ============================================
// for the hard-coded servers
// ============================================
export interface HardCodedMcpServer {
  name: string;
  config: Record<string, unknown>;
  displayName: string;
  description?: string;
  link?: string;
  doc?: string;
  iconPath?: string;
}
