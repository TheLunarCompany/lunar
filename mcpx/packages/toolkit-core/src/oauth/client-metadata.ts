/**
 * OAuth Client ID Metadata Document (CIMD). The router serves it, mcpx-server
 * sends its URL as the client id instead of registering via DCR.
 *
 * Shared, not duplicated, because drift is an outage: a stale path means a
 * client id the server cannot fetch, and the SDK has no DCR fallback.
 */
import { z } from "zod";

/** Where the document is served, and therefore what its `client_id` is. */
export const CLIENT_METADATA_PATH = "/.well-known/oauth-client-metadata.json";

/** Space flow (router) and analyze flow (webserver) callback paths. */
const ROUTER_REDIRECT_PATH = "/auth/callback";
const WEBSERVER_REDIRECT_PATH = "/oauth/callback";

/** How the client names itself, here and in a DCR registration. */
export const CLIENT_NAME = "mcpx-server";
export const CLIENT_URI = "https://github.com/TheLunarCompany/lunar";

/**
 * The SDK's `OAuthClientMetadata` plus the self-referential `client_id`,
 * declared here so this package stays free of the MCP SDK. dcr.test.ts pins
 * the two shapes together.
 */
export interface ClientMetadataDocument {
  client_id: string;
  client_name: string;
  client_uri: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
}

/** Fields a reader needs; unknown keys are ignored for forward compat. */
export const clientMetadataDocumentSchema = z.object({
  client_id: z.string(),
  redirect_uris: z.array(z.string()),
});

/** Document shape as seen by a reader (subset of what the publisher writes). */
export type PublishedClientMetadata = z.infer<
  typeof clientMetadataDocumentSchema
>;

/** Avoids `//path` when concatenating origin + path. */
export function stripTrailingSlash(origin: string): string {
  return origin.replace(/\/+$/, "");
}

/** Builds the CIMD document. Optional `webserverPublicUrl` for analyze callback. */
export function buildClientMetadataDocument(params: {
  baseUrl: string;
  webserverPublicUrl?: string;
}): ClientMetadataDocument {
  const baseUrl = stripTrailingSlash(params.baseUrl);
  const webserverPublicUrl = params.webserverPublicUrl
    ? stripTrailingSlash(params.webserverPublicUrl)
    : undefined;
  return {
    client_id: `${baseUrl}${CLIENT_METADATA_PATH}`,
    client_name: CLIENT_NAME,
    client_uri: CLIENT_URI,
    redirect_uris: [
      `${baseUrl}${ROUTER_REDIRECT_PATH}`,
      ...(webserverPublicUrl
        ? [`${webserverPublicUrl}${WEBSERVER_REDIRECT_PATH}`]
        : []),
    ],
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  };
}
