import { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";

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
};
