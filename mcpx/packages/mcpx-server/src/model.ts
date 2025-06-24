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
  args: z.array(z.string()).optional().default([]),
  command: z.string(),
  env: z.record(z.string(), z.string()).optional().default({}),
  icon: z.string().optional(),
});

export const targetServerConfigSchema = z.object({
  mcpServers: z.record(z.string(), targetServerSchema).optional().default({}),
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
  // TODO: Move the type discrimination to McpxSession itself,
  //  to eliminate stuff like `session.transport.transport.handleMessage()`
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
  toolExtensions: ToolExtensions;
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

export interface ToolExtensions {
  services: Record<string, ServiceToolExtensions>;
}

export interface ServiceToolExtensions {
  [toolName: string]: {
    childTools: ToolExtension[];
  };
}

export interface ToolExtension {
  name: string;
  description?: ToolExtensionDescription;
  overrideParams: Record<string, ToolExtensionOverrideValue>;
}

export interface ToolExtensionDescription {
  _type: "append" | "rewrite";
  text: string;
}

export type ToolExtensionOverrideValue = string | number | boolean;

const descriptionInput = z.union([
  z
    .object({ append: z.string() })
    .strict() // no extra keys allowed
    .transform(({ append }) => ({
      _type: "append" as const,
      text: append,
    })),

  z
    .object({ rewrite: z.string() })
    .strict()
    .transform(({ rewrite }) => ({
      _type: "rewrite" as const,
      text: rewrite,
    })),
]);

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
      enabled: z
        .boolean()
        .default(false)
        .or(
          z
            .enum(["true", "false"])
            .default("false")
            .transform((value) => value === "true"),
        ),
      header: z.string().optional(),
    })
    .default({ enabled: false }),
  toolExtensions: z.object({
    services: z.record(
      z.string(),
      z.record(
        z.string(),
        z.object({
          childTools: z.array(
            z.object({
              name: z.string(),
              description: descriptionInput.optional(),
              overrideParams: z
                .record(
                  z.string(),
                  z.union([z.string(), z.number(), z.boolean()]),
                )
                .optional()
                .default({}),
            }),
          ),
        }),
      ),
    ),
  }),
});
