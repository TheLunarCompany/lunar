import z from "zod/v4";

export const completeOAuthPayloadSchema = z.object({
  serverName: z.string(),
  authorizationCode: z.string(),
  state: z.string(),
});
