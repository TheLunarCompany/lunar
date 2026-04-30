import z from "zod/v4";

// Additions to this payload we can do later on:
// Based on which sub-catalog were the secrets assigned?
// Secrets objects Names grouping
export const setSecretsPayloadSchema = z.object({
  secretsKeys: z.array(z.string().min(1)),
});

export type SetSecretsPayload = z.infer<typeof setSecretsPayloadSchema>;
