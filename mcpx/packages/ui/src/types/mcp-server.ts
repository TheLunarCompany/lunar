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
  | "connected_running"
  | "connected_stopped"
  | "connection_failed"
  | "pending_auth";

export type McpServerType = "stdio" | "sse" | "streamable-http";

export type McpServer = {
  args: string[];
  command?: string;
  configuration?: Record<string, any>;
  env?: Record<string, string>;
  icon?: string;
  id: string;
  name: string;
  status: McpServerStatus;
  connectionError?: string | null;
  tools: Array<McpServerTool>;
  usage: McpServerUsage;
  type: McpServerType;
  url?: string;
};
