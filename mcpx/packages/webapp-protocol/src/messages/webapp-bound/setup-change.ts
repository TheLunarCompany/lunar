import { z } from "zod/v4";
import {
  toolGroupSchema,
  newToolExtensionsMainSchema,
  staticOAuthSchema,
} from "@mcpx/shared-model";

// Mirrored from mcpx-server/src/model/target-servers.ts

export const targetServerStdioSchema = z.object({
  type: z.literal("stdio"),
  command: z.string(),
  args: z.array(z.string()).optional().default([]),
  env: z.record(z.string(), z.string()).optional().default({}),
  icon: z.string().optional(),
});

const remoteTargetServerSchema = z.object({
  url: z.string(),
  headers: z.record(z.string(), z.string()).optional(),
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

// Config schema for setup-change messages
export const setupConfigSchema = z.object({
  toolGroups: toolGroupSchema,
  toolExtensions: newToolExtensionsMainSchema,
  staticOauth: staticOAuthSchema,
});

export const setupChangePayloadSchema = z.object({
  source: z.enum(["user", "profile"]),
  targetServers: z.record(z.string(), targetServerSchema),
  config: setupConfigSchema,
});
