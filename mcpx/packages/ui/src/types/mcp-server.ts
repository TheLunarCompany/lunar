export type McpServerTool = {
  name: string;
  description: string;
  lastCalledAt?: Date | string | number | null;
  invocations: number;
};

export type McpServerUsage = {
  callCount: number;
  lastCalledAt?: Date | string | number | null;
};

export type McpServerStatus =
  | "connecting"
  | "connected_running"
  | "connected_inactive"
  | "connected_stopped"
  | "connection_failed"
  | "pending_auth"
  | "pending_input";

export type MissingEnvVar =
  | { key: string; type: "literal" }
  | { key: string; type: "fromEnv"; fromEnvName: string };

export const SERVER_STATUS: Record<McpServerStatus, McpServerStatus> = {
  connecting: "connecting",
  connected_running: "connected_running",
  connected_inactive: "connected_inactive",
  connected_stopped: "connected_stopped",
  connection_failed: "connection_failed",
  pending_auth: "pending_auth",
  pending_input: "pending_input",
} as const;

export type McpServerType = "stdio" | "sse" | "streamable-http";

export type EnvValue = string | { fromEnv: string } | null;

export type McpServer = {
  args: string[];
  command?: string;
  configuration?: Record<string, unknown>;
  env?: Record<string, EnvValue>;
  icon?: string;
  id: string;
  name: string;
  status: McpServerStatus;
  connectionError?: string | null;
  missingEnvVars?: MissingEnvVar[];
  tools: Array<McpServerTool>;
  usage: McpServerUsage;
  type: McpServerType;
  url?: string;
  headers?: Record<string, string>;
};
