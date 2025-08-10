export type Tool = {
  name: string;
  description: string;
  lastCalledAt?: Date | string | number | null;
  invocations: number;
};

export type ServerUsage = {
  callCount: number;
  lastCalledAt?: Date | string | number | null;
};

export type McpServer = {
  args: string[];
  command: string;
  configuration?: Record<string, any>;
  env: Record<string, string>;
  icon?: string;
  id: string;
  name: string;
  status: "connected_running" | "connected_stopped" | "connection_failed";
  connectionError?: string | null;
  tools: Array<{
    name: string;
    description?: string;
    invocations: number;
    lastCalledAt?: Date;
  }>;
  usage: {
    callCount: number;
    lastCalledAt?: Date | string | number | null;
  };
};

export interface McpJsonFormat {
  [serverName: string]: {
    args: string[];
    command: string;
    env: Record<string, string>;
    icon?: string;
  };
}
