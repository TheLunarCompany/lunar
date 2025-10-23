import z from "zod/v4";

export const usageStatsPayloadSchema = z.object({
  agents: z.object({}),
  targetServers: z.object({}),
});
