import z from "zod/v4";

export const setProfileSecretsPayloadSchema = z.object({
  // Secret values users can reference in target MCP server env configs
  // (via fromEnv/fromSecret). Sourced from k8s secrets assigned to the
  // owner's profiles. Surfaced in the catalog secret picker.
  profileSecrets: z.record(z.string().min(1), z.string()),
  // Source-side epoch ms; mcpx drops the snapshot if older than the
  // last one it applied for this owner. Defeats out-of-order resolves.
  timestamp: z.number().int().nonnegative(),
});

export type SetProfileSecretsPayload = z.infer<
  typeof setProfileSecretsPayloadSchema
>;
