import z from "zod/v4";

export const targetServerStatus = z.enum([
  "connected",
  "pending-auth",
  "connection-failed",
]);

export const targetServerType = z.enum(["stdio", "sse", "streamable-http"]);

export const targetSever = z.object({
  name: z.string(),
  status: targetServerStatus,
  type: targetServerType,
  tools: z.record(
    z.string(),
    z.object({
      description: z.string().optional(),
      isCustom: z.boolean(),
      usage: z.object({
        callCount: z.number().int().nonnegative(),
        lastCalledAt: z.date().optional(),
      }),
    })
  ),
});

export const usageStatsPayloadSchema = z.object({
  agents: z.array(
    z.object({
      clientInfo: z.object({
        protocolVersion: z.string().optional(),
        name: z.string().optional(),
        version: z.string().optional(),
      }),
    })
  ),
  targetServers: z.array(targetSever),
});

export type UsageStatsTargetServer = z.infer<typeof targetSever>;
