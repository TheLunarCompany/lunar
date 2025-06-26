export type Tool = {
  name: string;
  description: string;
  lastCalledAt?: string | null;
  invocations: number;
};

export type ServerUsage = {
  callCount: number;
  lastCalledAt?: string | null;
};

export type McpServer = {
  args: string[];
  command: string;
  configuration?: Record<string, any>;
  env: Record<string, string>;
  icon?: string;
  id: string;
  name: string;
  status: "connected_running" | "connected_stopped";
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
