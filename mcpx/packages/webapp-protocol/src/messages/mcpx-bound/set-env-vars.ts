import z from "zod/v4";

export const setEnvVarsPayloadSchema = z.object({
  entries: z.record(z.string().min(1), z.string()),
});

export type SetEnvVarsPayload = z.infer<typeof setEnvVarsPayloadSchema>;
