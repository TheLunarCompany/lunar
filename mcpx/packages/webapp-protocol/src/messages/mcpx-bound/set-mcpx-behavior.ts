import z from "zod/v4";

export const mcpxBehaviorSettingsSchema = z.object({
  featureFlags: z.object({
    enableResourceCapability: z.boolean(),
    // add here more FFs as they are migrated
  }),
  // add here more behavior settings that will be migrated to hub in the future.
  policies: z.object({
    stdioServersEnabled: z.boolean(),
    dockerInDockerEnabled: z.boolean(),
    // add here more policies as they are migrated
  }),
});

export const setMcpxBehaviorPayloadSchema = z.object({
  mcpxBehaviorSettings: mcpxBehaviorSettingsSchema,
  // Source-side epoch ms; mcpx drops the snapshot if older than the
  // last one it applied for this owner. Defeats out-of-order resolves.
  timestamp: z.number().int().nonnegative(),
});

export type SetMcpxBehaviorPayload = z.infer<
  typeof setMcpxBehaviorPayloadSchema
>;

export type McpxBehaviorSettings = z.infer<typeof mcpxBehaviorSettingsSchema>;
