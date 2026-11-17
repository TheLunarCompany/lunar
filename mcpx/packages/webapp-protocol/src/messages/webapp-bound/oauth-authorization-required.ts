import z from "zod/v4";

export const oauthAuthorizationRequiredPayloadSchema = z.object({
  serverName: z.string(),
  authorizationUrl: z.string(),
  userCode: z.string().optional(),
});
