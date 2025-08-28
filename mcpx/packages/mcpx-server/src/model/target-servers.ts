import { Tool as McpTool } from "@modelcontextprotocol/sdk/types.js";
import z from "zod/v4";

export const targetServerStdioSchema = z.object({
  type: z.literal("stdio").default("stdio"),
  command: z.string(),
  args: z.array(z.string()).optional().default([]),
  env: z.record(z.string(), z.string()).optional().default({}),
  icon: z.string().optional(),
});

export const targetServerSseSchema = z.object({
  type: z.literal("sse"),
  url: z.string(),
});

export const targetServerStreamableHttpSchema = z.object({
  type: z.literal("streamable-http"),
  url: z.string(),
});

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
export type TargetServer =
  | SSETargetServer
  | StreamableHttpTargetServer
  | StdioTargetServer;

export type Tool = Pick<McpTool, "description" | "inputSchema" | "name"> & {};
