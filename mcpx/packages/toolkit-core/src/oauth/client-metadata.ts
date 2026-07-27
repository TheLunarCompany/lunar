/**
 * OAuth Client ID Metadata Document (CIMD). The router serves it, mcpx-server
 * sends its URL as the client id instead of registering via DCR.
 *
 * Shared, not duplicated, because drift is an outage: a stale path means a
 * client id the server cannot fetch, and the SDK has no DCR fallback.
 */

/** Where the document is served, and therefore what its `client_id` is. */
export const CLIENT_METADATA_PATH = "/.well-known/oauth-client-metadata.json";

/**
 * Callbacks mcpx-server can be sent back to, as paths on the serving origin.
 * Fixed, unlike DCR, so any other redirect_uri is rejected. Private on purpose:
 * consumers go through clientRedirectUris, so one list is published and gated.
 */
const CLIENT_REDIRECT_PATHS = ["/auth/callback"] as const;

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

/** Every redirect_uri the document advertises for a given origin. */
export function clientRedirectUris(baseUrl: string): string[] {
  return CLIENT_REDIRECT_PATHS.map((path) => `${baseUrl}${path}`);
}

/**
 * `client_id` comes from the serving origin, so it always equals the URL the
 * document was fetched from. Servers reject it otherwise.
 */
export function buildClientMetadataDocument(
  baseUrl: string,
): ClientMetadataDocument {
  return {
    client_id: `${baseUrl}${CLIENT_METADATA_PATH}`,
    client_name: CLIENT_NAME,
    client_uri: CLIENT_URI,
    redirect_uris: clientRedirectUris(baseUrl),
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  };
}
