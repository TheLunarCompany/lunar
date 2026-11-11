import { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { PublishedClientMetadata } from "@mcpx/toolkit-core/oauth";

// Our custom OAuth provider interface narrows down `state` and adds methods.

export type OAuthProviderType = "dcr" | "static" | "device_flow";
export const OAUTH_PROMPT_PARAM = "prompt";
export const SELECT_ACCOUNT_PROMPT = "select_account";
export const CONSENT_PROMPT = "consent";
export type Prompt = typeof SELECT_ACCOUNT_PROMPT | typeof CONSENT_PROMPT;

export type ExtraAuthorizationParams = {
  access_type?: "offline" | "online";
  prompt?: Prompt[];
  consentSupported?: boolean;
};

export type McpxOAuthProviderI = Omit<OAuthClientProvider, "state"> & {
  type: OAuthProviderType;
  serverName: string;
  state(): string;
  completeAuthorization(authorizationCode?: string): void;
  getAuthorizationCode(): string | null;
  getAuthorizationUrl(): URL | null;
  getUserCode(): string | null; // Only for device flow
  /** Replaces scopes discovered from auth server metadata. */
  setDiscoveredScopes(scopes: string[]): void;
  /** Replaces authorization request defaults selected from server metadata. */
  setExtraAuthorizationParams(params: ExtraAuthorizationParams): void;
  /** Why CIMD is unavailable (logging). DCR-only; others leave unimplemented. */
  clientMetadataSkipReason?(): string | undefined;
  /** Expected CIMD document URL, if this flow could use one. */
  readonly expectedClientMetadataUrl?: string | undefined;
  /** Settles `clientMetadataUrl` from the published document, before auth(). */
  applyPublishedDocument?(document: PublishedClientMetadata | undefined): void;
};
