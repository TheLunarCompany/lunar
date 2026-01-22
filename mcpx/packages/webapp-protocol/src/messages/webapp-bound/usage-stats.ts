import z from "zod/v4";

export const targetServerStatus = z.enum([
  "connected",
  "pending-auth",
  "pending-input",
  "connection-failed",
]);

export const missingEnvVarSchema = z.discriminatedUnion("type", [
  z.object({ key: z.string(), type: z.literal("literal") }),
  z.object({
    key: z.string(),
    type: z.literal("fromEnv"),
    fromEnvName: z.string(),
  }),
]);

export const targetServerType = z.enum(["stdio", "sse", "streamable-http"]);

export const toolSchema = z.object({
  description: z.string().optional(),
  parameters: z
    .array(z.object({ name: z.string(), description: z.string().optional() }))
    .optional(),
  isCustom: z.boolean(),
  estimatedTokens: z.number().int().nonnegative().optional(),
  usage: z.object({
    callCount: z.number().int().nonnegative(),
    lastCalledAt: z.string().pipe(z.coerce.date()).optional(),
  }),
});

const baseTargetServerSchema = z.object({
  name: z.string(),
  status: targetServerStatus,
  tools: z.record(z.string(), toolSchema),
});

export const targetSever = z.discriminatedUnion("type", [
  baseTargetServerSchema.extend({
    type: z.literal("stdio"),
    missingEnvVars: z.array(missingEnvVarSchema).optional(),
  }),
  baseTargetServerSchema.extend({
    type: z.literal("sse"),
  }),
  baseTargetServerSchema.extend({
    type: z.literal("streamable-http"),
  }),
]);

export const usageStatsPayloadSchema = z.object({
  agents: z.array(
    z.object({
      clientInfo: z.object({
        protocolVersion: z.string().optional(),
        name: z.string().optional(),
        version: z.string().optional(),
      }),
    }),
  ),
  targetServers: z.array(targetSever),
});

export type UsageStatsTargetServer = z.infer<typeof targetSever>;
export type UsageStatsTargetServerInput = z.input<typeof targetSever>;
