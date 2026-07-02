import { Tool as McpTool } from "@modelcontextprotocol/sdk/types.js";
import z from "zod/v4";
import { AllowedCommands } from "@mcpx/shared-model";

export const envValueSchema = z.preprocess(
  // preprocess for backward compatibility for already connected servers that used a "" instead of an explicit null
  (val: unknown) => {
    if (typeof val === "string") {
      return val.trim() === "" ? null : val;
    }
    return val;
  },
  z.union([
    z.string().trim().min(1), // only in the mcpx-server TargetServer object, make sure there are no empty strings (all are replaced with null)
    z.object({ fromEnv: z.string() }),
    z.object({ fromSecret: z.string() }),
    z.null(),
  ]),
);

export type EnvValue = z.infer<typeof envValueSchema>;

export const targetServerStdioSchema = z.object({
  type: z.literal("stdio").default("stdio"),
  command: AllowedCommands,
  args: z.array(z.string()).optional().default([]),
  env: z.record(z.string(), envValueSchema).optional().default({}),
  icon: z.string().optional(),
});

const remoteTargetServerSchema = z.object({
  url: z.string(),
  headers: z.record(z.string(), envValueSchema).optional(),
  icon: z.string().optional(),
});

export const targetServerSseSchema = remoteTargetServerSchema.extend({
  type: z.literal("sse"),
});
export const targetServerStreamableHttpSchema = remoteTargetServerSchema.extend(
  { type: z.literal("streamable-http") },
);

export const targetServerSchema = z.union([
  targetServerStdioSchema,
  targetServerSseSchema,
  targetServerStreamableHttpSchema,
]);

export const createTargetServerSchema = targetServerSchema.and(
  z.object({ name: z.string() }),
);

// TODO (RND-837): only used by the dead ws-ui update handler; remove after rollout.
export const updateTargetServerPayloadSchema = z.object({
  name: z.string(),
  server: targetServerSchema,
});

export const targetServerConfigSchema = z.object({
  mcpServers: z.record(z.string(), targetServerSchema).optional().default({}),
});

export type ServerName = { name: string };
export type CatalogMeta = { catalogItemId?: string };
export type StdioTargetServer = z.infer<typeof targetServerStdioSchema> &
  ServerName &
  CatalogMeta;
export type SSETargetServer = z.infer<typeof targetServerSseSchema> &
  ServerName &
  CatalogMeta;
export type StreamableHttpTargetServer = z.infer<
  typeof targetServerStreamableHttpSchema
> &
  ServerName &
  CatalogMeta;
export type RemoteTargetServer = SSETargetServer | StreamableHttpTargetServer;
export type TargetServer = StdioTargetServer | RemoteTargetServer;

export type Tool = Pick<McpTool, "description" | "inputSchema" | "name"> & {};
