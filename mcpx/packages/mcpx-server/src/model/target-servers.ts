import { Tool as McpTool } from "@modelcontextprotocol/sdk/types.js";
import z from "zod/v4";
import { AllowedCommands } from "@mcpx/shared-model";

export const envValueSchema = z.union([
  z.string(),
  z.object({ fromEnv: z.string() }),
]);

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
  headers: z.record(z.string(), z.string()).optional(),
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

export const targetServerConfigSchema = z.object({
  mcpServers: z.record(z.string(), targetServerSchema).optional().default({}),
});

export type ServerName = { name: string };
export type StdioTargetServer = z.infer<typeof targetServerStdioSchema> &
  ServerName;
export type SSETargetServer = z.infer<typeof targetServerSseSchema> &
  ServerName;
export type StreamableHttpTargetServer = z.infer<
  typeof targetServerStreamableHttpSchema
> &
  ServerName;
export type RemoteTargetServer = SSETargetServer | StreamableHttpTargetServer;
export type TargetServer = StdioTargetServer | RemoteTargetServer;

export type Tool = Pick<McpTool, "description" | "inputSchema" | "name"> & {};
