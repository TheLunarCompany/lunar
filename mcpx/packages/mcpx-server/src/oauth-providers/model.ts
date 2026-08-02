import { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { PublishedClientMetadata } from "@mcpx/toolkit-core/oauth";

// Our custom OAuth provider interface narrows down `state` and adds methods.

export type OAuthProviderType = "dcr" | "static" | "device_flow";
export type McpxOAuthProviderI = Omit<OAuthClientProvider, "state"> & {
  type: OAuthProviderType;
  serverName: string;
  state(): string;
  completeAuthorization(authorizationCode?: string): void;
  getAuthorizationCode(): string | null;
  getAuthorizationUrl(): URL | null;
  getUserCode(): string | null; // Only for device flow
  /** Adds a scope discovered from auth server metadata (e.g. "offline_access") */
  setDiscoveredScope(scope: string): void;
  /** Why CIMD is unavailable (logging). DCR-only; others leave unimplemented. */
  clientMetadataSkipReason?(): string | undefined;
  /** Expected CIMD document URL, if this flow could use one. */
  readonly expectedClientMetadataUrl?: string | undefined;
  /** Settles `clientMetadataUrl` from the published document, before auth(). */
  applyPublishedDocument?(document: PublishedClientMetadata | undefined): void;
};
