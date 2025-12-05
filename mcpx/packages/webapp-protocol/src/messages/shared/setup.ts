import { z } from "zod/v4";
import {
  authSchema,
  permissionsSchema,
  staticOAuthSchema,
  targetServerAttributesSchema,
  toolExtensionsSchema,
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

// Mirroring mcpx/packages/shared-model/src/config/config.ts,
// but representing post-normalization state - i.e., marked tools are expanded
// from `*` to the full list of tools in that group (known at setup time).
export const normalizedToolGroupSchema = z.array(
  z.object({
    name: z.string(),
    services: z.record(z.string(), z.array(z.string())),
  }),
);

// Config schema for setup-change messages
export const setupConfigSchema = z.object({
  permissions: permissionsSchema,
  toolGroups: normalizedToolGroupSchema,
  auth: authSchema,
  toolExtensions: toolExtensionsSchema,
  targetServerAttributes: targetServerAttributesSchema,
  staticOauth: staticOAuthSchema,
});
