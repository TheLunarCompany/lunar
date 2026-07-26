import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { DcrOAuthProvider } from "./dcr.js";
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

describe("DcrOAuthProvider#redirectToAuthorization", () => {
  // Regression: it used to block on a promise resolved only when the user
  // completed the redirect, which hung silent token-reuse during setup-apply.
  it("resolves immediately and records the URL (does not block on the user)", async () => {
    const provider = new DcrOAuthProvider({
      serverName: "notion",
      logger: noOpLogger,
      tokenStore: stubTokenStore,
    });

    const outcome = await Promise.race([
      provider
        .redirectToAuthorization(new URL("https://mcp.notion.com/authorize"))
        .then(() => "resolved" as const),
      new Promise<"blocked">((resolve) =>
        setTimeout(() => resolve("blocked"), 100),
      ),
    ]);

    expect(outcome).toBe("resolved");
    expect(provider.getAuthorizationUrl()?.host).toBe("mcp.notion.com");
  });
});
