import { noOpLogger } from "@aigw/core/logging";
import { OAuthTokenStoreI } from "../services/oauth-token-store.js";
import { DcrOAuthProvider } from "./dcr.js";
import { DeviceFlowOAuthProvider } from "./device-flow.js";
import { StaticOAuthProvider } from "./static.js";

const tokenStore: OAuthTokenStoreI = {
  loadTokens: async () => undefined,
  saveTokens: async () => {},
  loadCodeVerifier: async () => undefined,
  saveCodeVerifier: async () => {},
  loadClientInfo: async () => undefined,
  saveClientInfo: async () => {},
  deleteAll: async () => {},
};

const options = {
  serverName: "test",
  logger: noOpLogger,
  tokenStore,
  callbackUrl: "https://mcpx.example.com/oauth/callback",
};
const clientId = { type: "literal", value: "client" } as const;

describe.each([
  {
    name: "static",
    configuredScope: "openid",
    create: () =>
      new StaticOAuthProvider({
        ...options,
        clientId: "client",
        clientSecret: "secret",
        config: {
          authMethod: "client_credentials",
          scopes: ["openid"],
          tokenAuthMethod: "client_secret_basic",
          credentials: {
            clientId,
            clientSecret: { type: "literal", value: "secret" },
          },
        },
      }),
  },
  {
    name: "device flow",
    configuredScope: "openid",
    create: () =>
      new DeviceFlowOAuthProvider({
        ...options,
        clientId: "client",
        config: {
          authMethod: "device_flow",
          scopes: ["openid"],
          credentials: { clientId },
          endpoints: {
            deviceAuthorizationUrl: "https://auth.example.com/device/code",
            tokenUrl: "https://auth.example.com/token",
            userVerificationUrl: "https://auth.example.com/device",
          },
        },
      }),
  },
  {
    name: "DCR",
    configuredScope: undefined,
    create: () => new DcrOAuthProvider(options),
  },
])("$name provider scopes", ({ create, configuredScope }) => {
  it("merges discovered scopes without duplicates", () => {
    const provider = create();

    provider.setDiscoveredScopes(["openid", "offline_access", "openid"]);

    expect(provider.clientMetadata.scope).toBe("openid offline_access");
  });

  it("keeps configured scopes when discovery supplies no scopes", () => {
    const provider = create();

    provider.setDiscoveredScopes([]);

    expect(provider.clientMetadata.scope).toBe(configuredScope);
  });

  it("replaces previously discovered scopes", () => {
    const provider = create();
    provider.setDiscoveredScopes(["profile"]);

    provider.setDiscoveredScopes(["offline_access"]);

    expect(provider.clientMetadata.scope).toBe(
      configuredScope ? "openid offline_access" : "offline_access",
    );
  });
});
