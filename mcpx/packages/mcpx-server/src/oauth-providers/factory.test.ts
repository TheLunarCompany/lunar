import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { OAuthProviderFactory } from "./factory.js";
import { DcrOAuthProvider } from "./dcr.js";
import { OAuthClientInformationFull } from "@modelcontextprotocol/sdk/shared/auth.js";
import {
  OAuthTokenStoreI,
  StoredTokens,
} from "../services/oauth-token-store.js";
import { EnvVarResolver } from "../services/env-var-manager.js";

const emptyEnvVarResolver: EnvVarResolver = { resolve: () => undefined };

function makeMemoryStore(): OAuthTokenStoreI {
  const tokens = new Map<string, StoredTokens>();
  const verifiers = new Map<string, string>();
  const clients = new Map<string, OAuthClientInformationFull>();
  return {
    async loadTokens(serverName) {
      return tokens.get(serverName);
    },
    async saveTokens(serverName, data) {
      tokens.set(serverName, data);
    },
    async loadCodeVerifier(serverName) {
      return verifiers.get(serverName);
    },
    async saveCodeVerifier(serverName, verifier) {
      verifiers.set(serverName, verifier);
    },
    async loadClientInfo(serverName) {
      return clients.get(serverName);
    },
    async saveClientInfo(serverName, info) {
      clients.set(serverName, info);
    },
    async deleteAll(serverName) {
      tokens.delete(serverName);
      verifiers.delete(serverName);
      clients.delete(serverName);
    },
  };
}

describe("OAuthProviderFactory", () => {
  describe(".deleteTokensForServer", () => {
    it("should delete all tokens for a server", async () => {
      const tokenStore = makeMemoryStore();
      await tokenStore.saveTokens("myserver", {
        access_token: "tok",
        token_type: "bearer",
      });
      await tokenStore.saveCodeVerifier("myserver", "verifier");
      await tokenStore.saveClientInfo("myserver", {
        client_id: "id",
        redirect_uris: [],
      });

      const factory = new OAuthProviderFactory(noOpLogger, {
        tokenStore,
        envVars: emptyEnvVarResolver,
      });
      await factory.deleteTokensForServer("myserver");

      expect(await tokenStore.loadTokens("myserver")).toBeUndefined();
      expect(await tokenStore.loadCodeVerifier("myserver")).toBeUndefined();
      expect(await tokenStore.loadClientInfo("myserver")).toBeUndefined();
    });

    it("should not throw when tokens do not exist", async () => {
      const tokenStore = makeMemoryStore();
      const factory = new OAuthProviderFactory(noOpLogger, {
        tokenStore,
        envVars: emptyEnvVarResolver,
      });

      await expect(
        factory.deleteTokensForServer("nonexistent"),
      ).resolves.not.toThrow();
    });

    it("should only delete tokens for the specified server", async () => {
      const tokenStore = makeMemoryStore();
      await tokenStore.saveTokens("target", {
        access_token: "target-tok",
        token_type: "bearer",
      });
      await tokenStore.saveTokens("other", {
        access_token: "other-tok",
        token_type: "bearer",
      });

      const factory = new OAuthProviderFactory(noOpLogger, {
        tokenStore,
        envVars: emptyEnvVarResolver,
      });
      await factory.deleteTokensForServer("target");

      expect(await tokenStore.loadTokens("target")).toBeUndefined();
      expect((await tokenStore.loadTokens("other"))?.access_token).toBe(
        "other-tok",
      );
    });
  });
});

describe("DcrOAuthProvider token expiry", () => {
  function makeProvider(): {
    provider: DcrOAuthProvider;
    tokenStore: OAuthTokenStoreI;
  } {
    const tokenStore = makeMemoryStore();
    const provider = new DcrOAuthProvider({
      serverName: "test-server",
      logger: noOpLogger,
      tokenStore,
    });
    return { provider, tokenStore };
  }

  it("saveTokens stores expires_at computed from expires_in", async () => {
    const { provider, tokenStore } = makeProvider();
    const before = Date.now();
    await provider.saveTokens({
      access_token: "tok",
      token_type: "bearer",
      expires_in: 3600,
    });
    const after = Date.now();

    const stored = await tokenStore.loadTokens("test-server");
    expect(stored?.expires_at).toBeGreaterThanOrEqual(before + 3600 * 1000);
    expect(stored?.expires_at).toBeLessThanOrEqual(after + 3600 * 1000);
  });

  it("tokens() returns tokens before expiry", async () => {
    const { provider } = makeProvider();
    await provider.saveTokens({
      access_token: "tok",
      token_type: "bearer",
      expires_in: 3600,
    });

    const result = await provider.tokens();
    expect(result?.access_token).toBe("tok");
  });

  it("tokens() returns undefined when expires_at is in the past", async () => {
    const { provider, tokenStore } = makeProvider();
    await tokenStore.saveTokens("test-server", {
      access_token: "tok",
      token_type: "bearer",
      expires_at: Date.now() - 1,
    });

    const result = await provider.tokens();
    expect(result).toBeUndefined();
  });

  it("tokens() returns tokens when expires_at is absent (backward compat)", async () => {
    const { provider, tokenStore } = makeProvider();
    await tokenStore.saveTokens("test-server", {
      access_token: "old-tok",
      token_type: "bearer",
    });

    const result = await provider.tokens();
    expect(result?.access_token).toBe("old-tok");
  });
});
