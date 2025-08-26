import { loggableError } from "@mcpx/toolkit-core/logging";
import { Logger } from "winston";
import z from "zod/v4";
import { RemoteTargetServer } from "../model/target-servers.js";

// These schemas are based on the OAuth 2.0 spec and conventions
const protectedResourceSchema = z.object({
  authorization_servers: z.array(z.unknown()).min(1),
});

const authServerSchema = z.object({
  authorization_endpoint: z.string().optional(),
  token_endpoint: z.string().optional(),
});

// Type for the fetch function to enable dependency injection
export type FetchFn = typeof fetch;

// Check if a remote server supports OAuth by looking for well-known endpoints
// Note that this implementation is based on the assumption that MCP servers will
// implement the OAuth spec correctly, or at least follow some of the conventions.
// This is a legitimate assumption since the MCP TS SDK uses this approach as well,
// to the best of our knowledge.
export async function detectOAuthSupport(
  targetServer: RemoteTargetServer,
  discoveryTimeoutMillis: number,
  logger: Logger,
  fetchFn: FetchFn = fetch,
): Promise<boolean> {
  try {
    const baseUrl = new URL(targetServer.url).origin;

    // Check both endpoints in parallel
    const [protectedResourceResult, authServerResult] =
      await Promise.allSettled([
        // Check protected resource metadata (correct per MCP spec, e.g. Notion)
        fetchFn(`${baseUrl}/.well-known/oauth-protected-resource`, {
          method: "GET",
          signal: AbortSignal.timeout(discoveryTimeoutMillis),
        }).then(async (response) => {
          if (!response.ok) return false;
          const json = await response.json();
          const parsed = protectedResourceSchema.safeParse(json);
          return parsed.success;
        }),

        // Check authorization server metadata (sometimes used by MCP servers, e.g. Linear)
        fetchFn(`${baseUrl}/.well-known/oauth-authorization-server`, {
          method: "GET",
          signal: AbortSignal.timeout(discoveryTimeoutMillis),
        }).then(async (response) => {
          if (!response.ok) return false;
          const json = await response.json();
          const parsed = authServerSchema.safeParse(json);
          return (
            parsed.success &&
            Boolean(
              parsed.data.authorization_endpoint || parsed.data.token_endpoint,
            )
          );
        }),
      ]);

    // If either result is `fulfilled` (i.e. successful HTTP call, including schema validation),
    // and valid, OAuth is assumed to be supported
    const protectedResourceSupported =
      protectedResourceResult.status === "fulfilled" &&
      protectedResourceResult.value;
    const authServerSupported =
      authServerResult.status === "fulfilled" && authServerResult.value;

    const oauthSupported = protectedResourceSupported || authServerSupported;

    logger.debug(
      `OAuth support ${oauthSupported ? "was" : "was not"} detected`,
      {
        name: targetServer.name,
        url: targetServer.url,
        basedOn: {
          protectedResource: protectedResourceSupported,
          authServer: authServerSupported,
        },
      },
    );
    return oauthSupported;
  } catch (error) {
    logger.debug("Error checking OAuth support", {
      name: targetServer.name,
      error: loggableError(error),
    });
    return false;
  }
}
