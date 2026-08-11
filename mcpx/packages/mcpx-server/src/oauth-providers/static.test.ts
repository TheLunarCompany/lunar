import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { StaticOAuthProvider } from "./static.js";
import { OAuthTokenStoreI } from "../services/oauth-token-store.js";

const stubTokenStore: OAuthTokenStoreI = {
  loadTokens: async () => undefined,
  saveTokens: async () => {},
  loadCodeVerifier: async () => undefined,
  saveCodeVerifier: async () => {},
  loadClientInfo: async () => undefined,
  saveClientInfo: async () => {},
  deleteAll: async () => {},
};

function makeProvider() {
  return new StaticOAuthProvider({
    serverName: "github",
    config: {
      authMethod: "client_credentials",
      scopes: ["read"],
      tokenAuthMethod: "client_secret_basic",
      credentials: {
        clientId: { type: "literal", value: "id-abc" },
        clientSecret: { type: "literal", value: "secret-xyz" },
      },
    },
    clientId: "id-abc",
    clientSecret: "secret-xyz",
    logger: noOpLogger,
    tokenStore: stubTokenStore,
  });
}

describe("StaticOAuthProvider#redirectToAuthorization", () => {
  // Regression: an older version awaited a promise that only settled when the
  // user finished the browser redirect, which hung setup-apply when tokens were
  // missing and no user was present to authorize.
  it("returns without waiting for the user to finish authorization", async () => {
    const provider = makeProvider();

    await expect(
      provider.redirectToAuthorization(
        new URL("https://github.com/login/oauth/authorize"),
      ),
    ).resolves.toBeUndefined();
  }, 100);

  it("stores the authorization URL with prompt=select_account for the callback flow", async () => {
    const provider = makeProvider();
    const authUrl = new URL("https://github.com/login/oauth/authorize");

    await provider.redirectToAuthorization(authUrl);

    expect(provider.getAuthorizationUrl()?.toString()).toBe(
      "https://github.com/login/oauth/authorize?prompt=select_account",
    );
  });

  it("clears the stored URL when authorization completes", async () => {
    const provider = makeProvider();
    await provider.redirectToAuthorization(
      new URL("https://github.com/login/oauth/authorize"),
    );

    provider.completeAuthorization("auth-code");

    expect(provider.getAuthorizationUrl()).toBeNull();
    expect(provider.getAuthorizationCode()).toBe("auth-code");
  });
});
