import z from "zod/v4";

export const setOauthCredentialsPayloadSchema = z.object({
  // Admin static OAuth client credentials. Used only by mcpx's OAuth flow
  // to talk to OAuth providers. Not referenceable from target MCP server
  // env configs; not spread into child env on STDIO_INHERIT.
  oauthCredentials: z.record(z.string().min(1), z.string()),
  // Source-side epoch ms; mcpx drops the snapshot if older than the
  // last one it applied for this owner. Defeats out-of-order resolves.
  timestamp: z.number().int().nonnegative(),
});

export type SetOauthCredentialsPayload = z.infer<
  typeof setOauthCredentialsPayloadSchema
>;
