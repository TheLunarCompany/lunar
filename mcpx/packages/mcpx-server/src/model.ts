import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod/v4";

export interface TargetServersConfig {
  servers: Record<string, RawServerData>;
}

interface RawServerData {
  address: string;
}

export const targetServerSchema = z.object({
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
});
export const targetServerConfigSchema = z.object({
  mcpServers: z.record(z.string(), targetServerSchema),
});

export type TargetServerConfig = z.infer<typeof targetServerSchema>;
export type TargetServer = TargetServerConfig & { name: string };

export type Tool = {
  name: string;
  inputSchema: {
    type: "object";
    properties?: unknown;
  } & { [k: string]: unknown };
  description?: string | undefined;
};

export const messageSchema = z.object({
  method: z.string(),
  params: z
    .object({
      name: z.string().optional(),
      arguments: z.record(z.string(), z.any()).optional(),
    })
    .optional(),
});

export interface McpxSession {
  transport:
    | { type: "sse"; transport: SSEServerTransport }
    | { type: "streamableHttp"; transport: StreamableHTTPServerTransport };
  consumerConfig: ConsumerConfig | undefined | null; // undefined if not searched yet, null if not found
  metadata: {
    consumerTag?: string;
    llm?: {
      provider?: string;
      modelId?: string;
    };
  };
}

// Permissions
export type Permission = "allow" | "block";

// Config
export interface Config {
  permissions: PermissionsConfig;
  toolGroups: ToolGroup[];
  auth: {
    enabled: boolean;
    header?: string;
  };
}

export interface PermissionsConfig {
  base: Permission;
  consumers: Record<string, ConsumerConfig>;
}

export interface ConsumerConfig {
  base?: Permission;
  profiles?: {
    allow?: string[];
    block?: string[];
  };
}

export interface ToolGroup {
  name: string;
  services: Record<string, ServiceToolGroup>;
}

export type ServiceToolGroup = string[] | "*";

export const configSchema = z.object({
  permissions: z.object({
    base: z.enum(["allow", "block"]),
    consumers: z
      .record(
        z.string(),
        z.object({
          base: z.enum(["allow", "block"]).optional(),
          profiles: z
            .object({
              allow: z.array(z.string()).optional(),
              block: z.array(z.string()).optional(),
            })
            .default({ allow: [], block: [] }),
        }),
      )
      .default({}),
  }),
  toolGroups: z
    .array(
      z.object({
        name: z.string(),
        services: z.record(
          z.string(),
          z.union([z.array(z.string()), z.literal("*")]),
        ),
      }),
    )
    .default([]),
  auth: z
    .object({
      enabled: z.boolean().default(false),
      header: z.string().optional(),
    })
    .default({ enabled: false }),
});
