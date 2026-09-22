import z from "zod/v4";

export const initiateOAuthPayloadSchema = z.object({
  serverName: z.string(),
  callbackUrl: z.string(),
});
