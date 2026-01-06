import z from "zod/v4";

export const targetServerStatus = z.enum([
  "connected",
  "pending-auth",
  "connection-failed",
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

export const targetSever = z.object({
  name: z.string(),
  status: targetServerStatus,
  type: targetServerType,
  tools: z.record(z.string(), toolSchema),
});

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
