import z from "zod/v4";

export const oauthAuthorizationRequiredPayloadSchema = z.object({
  serverName: z.string(),
  authorizationUrl: z.string(),
  state: z.string(),
  userCode: z.string().optional(),
});
