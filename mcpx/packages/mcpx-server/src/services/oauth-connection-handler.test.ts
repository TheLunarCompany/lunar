import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import {
  McpxOAuthProviderI,
  OAuthProviderType,
} from "../oauth-providers/model.js";
import { OAuthSessionManagerI } from "../server/oauth-session-manager.js";
import { ExtendedClientBuilderI, ExtendedClientI } from "./client-extension.js";
import {
  isAuthenticationError,
  OAuthConnectionHandler,
  OAuthDiscovery,
} from "./oauth-connection-handler.js";

describe("OAuthConnectionHandler", () => {
  describe(".isAuthenticationError", () => {
    it("should return true for 401 status in response", () => {
      const error = { response: { status: 401 } };
      expect(isAuthenticationError(error)).toBe(true);
    });

    it("should return true for direct 401 status", () => {
      const error = { status: 401 };
      expect(isAuthenticationError(error)).toBe(true);
    });

    it("should return true for 401 code", () => {
      const error = { code: 401 };
      expect(isAuthenticationError(error)).toBe(true);
    });

    it("should return true for message containing '401'", () => {
      const error = { message: "HTTP 401 Unauthorized" };
      expect(isAuthenticationError(error)).toBe(true);
    });

    it("should return true for message containing 'Unauthorized'", () => {
      const error = { message: "Unauthorized access" };
      expect(isAuthenticationError(error)).toBe(true);
    });

    it("should return false for non-401 errors", () => {
      const error = { status: 500 };
      expect(isAuthenticationError(error)).toBe(false);
    });

    it("should return false for non-object errors", () => {
      expect(isAuthenticationError("string error")).toBe(false);
      expect(isAuthenticationError(null)).toBe(false);
      expect(isAuthenticationError(undefined)).toBe(false);
    });

    it("should return false for objects without auth-related properties", () => {
      const error = { message: "Some other error", code: 500 };
      expect(isAuthenticationError(error)).toBe(false);
    });
  });

  describe("two-phase OAuth flow", () => {
    const TEST_SERVER_NAME = "test-server";
    const TEST_STATE = "test-state-123";
    const TEST_AUTH_URL = new URL(
      "https://auth.example.com/authorize?state=test",
    );
    const TEST_AUTH_CODE = "test-auth-code-456";

    function createMockProvider(
      overrides: Partial<McpxOAuthProviderI> = {},
    ): McpxOAuthProviderI {
      return {
        type: "dcr" as OAuthProviderType,
        serverName: TEST_SERVER_NAME,
        state: () => TEST_STATE,
        completeAuthorization: () => {},
        getAuthorizationCode: () => null,
        getAuthorizationUrl: () => TEST_AUTH_URL,
        getUserCode: () => null,
        redirectUrl: "http://localhost:9000/oauth/callback",
        clientMetadata: {
          redirect_uris: ["http://localhost:9000/oauth/callback"],
        },
        clientInformation: async () => undefined,
        tokens: async () => undefined,
        saveTokens: async (_tokens: OAuthTokens) => {},
        redirectToAuthorization: async (_url: URL) => {},
        saveCodeVerifier: async (_verifier: string) => {},
        codeVerifier: async () => "",
        ...overrides,
      } as McpxOAuthProviderI;
    }

    function createMockSessionManager(
      provider: McpxOAuthProviderI,
    ): OAuthSessionManagerI {
      const flows = new Map<
        string,
        {
          serverName: string;
          serverUrl: string;
          state: string;
          createdAt: Date;
        }
      >();

      return {
        getOrCreateOAuthProvider: () => provider,
        startOAuthFlow: (serverName, serverUrl, state) => {
          flows.set(state, {
            serverName,
            serverUrl,
            state,
            createdAt: new Date(),
          });
        },
        getOAuthFlow: (state) => flows.get(state),
        completeOAuthFlow: (state) => {
          const flow = flows.get(state);
          flows.delete(state);
          return flow;
        },
        deleteOAuthTokensForServer: async (_serverName) => {},
        hasOAuthProvider: (_serverName) => false,
        getExistingOAuthProvider: (_serverName) => undefined,
        hasPersistedOAuthTokens: async () => false,
      };
    }

    function createMockExtendedClientBuilder(): ExtendedClientBuilderI {
      return {
        build: async () =>
          ({
            close: async () => {},
            listTools: async () => ({ tools: [], toolParentNames: {} }),
            callTool: async () => ({ content: [] }),
          }) as unknown as ExtendedClientI,
      };
    }

    describe(".cancelPendingOAuth", () => {
      it("should return false when no pending flow to cancel", () => {
        const provider = createMockProvider();
        const sessionManager = createMockSessionManager(provider);
        const clientBuilder = createMockExtendedClientBuilder();

        const handler = new OAuthConnectionHandler(
          sessionManager,
          clientBuilder,
          noOpLogger,
        );

        expect(handler.cancelPendingOAuth(TEST_SERVER_NAME)).toBe(false);
      });
    });

    describe(".getServerNameByState", () => {
      it("should return null when no flow exists for state", () => {
        const provider = createMockProvider();
        const sessionManager = createMockSessionManager(provider);
        const clientBuilder = createMockExtendedClientBuilder();

        const handler = new OAuthConnectionHandler(
          sessionManager,
          clientBuilder,
          noOpLogger,
        );

        expect(handler.getServerNameByState("unknown-state")).toBeNull();
      });
    });

    describe(".completeOAuth", () => {
      it("should throw when no pending flow exists", async () => {
        const provider = createMockProvider();
        const sessionManager = createMockSessionManager(provider);
        const clientBuilder = createMockExtendedClientBuilder();

        const handler = new OAuthConnectionHandler(
          sessionManager,
          clientBuilder,
          noOpLogger,
        );

        await expect(
          handler.completeOAuth(TEST_SERVER_NAME, TEST_AUTH_CODE),
        ).rejects.toThrow(
          `No pending OAuth flow for server: ${TEST_SERVER_NAME}`,
        );
      });
    });

    describe(".deleteOAuthTokensForServer", () => {
      it("should call session manager deleteOAuthTokensForServer", async () => {
        const provider = createMockProvider();
        let deletedServer: string | undefined;
        const sessionManager: OAuthSessionManagerI = {
          ...createMockSessionManager(provider),
          deleteOAuthTokensForServer: async (serverName: string) => {
            deletedServer = serverName;
          },
        };
        const handler = new OAuthConnectionHandler(
          sessionManager,
          createMockExtendedClientBuilder(),
          noOpLogger,
        );

        await handler.deleteOAuthTokensForServer(TEST_SERVER_NAME);

        expect(deletedServer).toBe(TEST_SERVER_NAME);
      });

      it("should not throw when there is no pending OAuth flow", async () => {
        const provider = createMockProvider();
        const sessionManager = createMockSessionManager(provider);
        const handler = new OAuthConnectionHandler(
          sessionManager,
          createMockExtendedClientBuilder(),
          noOpLogger,
        );

        await expect(
          handler.deleteOAuthTokensForServer(TEST_SERVER_NAME),
        ).resolves.not.toThrow();
      });
    });

    // Note: initiateOAuth is difficult to unit test because it creates real
    // transport instances that attempt network connections. Full integration
    // testing of the two-phase flow is covered by oauth.it.test.ts.
    // The key behaviors (storing pending flows, returning auth URL) are
    // implicitly tested through the IT tests.

    describe(".isTokenExpiredForServer", () => {
      const targetServer = {
        name: TEST_SERVER_NAME,
        type: "streamable-http" as const,
        url: "https://example.com",
      };

      it("returns false when no provider is registered for the server", async () => {
        const provider = createMockProvider();
        const sessionManager: OAuthSessionManagerI = {
          ...createMockSessionManager(provider),
          getExistingOAuthProvider: () => undefined,
        };
        const handler = new OAuthConnectionHandler(
          sessionManager,
          createMockExtendedClientBuilder(),
          noOpLogger,
        );

        expect(await handler.isTokenExpiredForServer(targetServer)).toBe(false);
      });

      it("returns false when provider has valid tokens", async () => {
        const provider = createMockProvider({
          tokens: async () => ({
            access_token: "tok",
            token_type: "bearer",
          }),
        });
        const sessionManager: OAuthSessionManagerI = {
          ...createMockSessionManager(provider),
          getExistingOAuthProvider: () => provider,
        };
        const handler = new OAuthConnectionHandler(
          sessionManager,
          createMockExtendedClientBuilder(),
          noOpLogger,
        );

        expect(await handler.isTokenExpiredForServer(targetServer)).toBe(false);
      });

      it("returns true when provider has no tokens (expired or never saved)", async () => {
        const provider = createMockProvider({
          tokens: async () => undefined,
        });
        const sessionManager: OAuthSessionManagerI = {
          ...createMockSessionManager(provider),
          getExistingOAuthProvider: () => provider,
        };
        const handler = new OAuthConnectionHandler(
          sessionManager,
          createMockExtendedClientBuilder(),
          noOpLogger,
        );

        expect(await handler.isTokenExpiredForServer(targetServer)).toBe(true);
      });
    });

    describe(".probeOAuthSupport", () => {
      const TEST_URL = "https://example.com";

      function buildHandler(discovery: OAuthDiscovery) {
        const provider = createMockProvider();
        const sessionManager = createMockSessionManager(provider);
        return new OAuthConnectionHandler(
          sessionManager,
          createMockExtendedClientBuilder(),
          noOpLogger,
          discovery,
        );
      }

      it("returns true when protected-resource metadata is advertised", async () => {
        const handler = buildHandler({
          discoverOAuthProtectedResourceMetadata: async () =>
            ({
              resource: TEST_URL,
              authorization_servers: ["https://auth.example.com"],
            }) as Awaited<
              ReturnType<
                OAuthDiscovery["discoverOAuthProtectedResourceMetadata"]
              >
            >,
          discoverAuthorizationServerMetadata: async () => undefined,
        });

        expect(await handler.probeOAuthSupport(TEST_URL)).toBe(true);
      });

      it("chains auth-server discovery to the URL named in protected-resource metadata", async () => {
        // RND-483 Bug 2: prior probe called auth-server discovery with the
        // resource URL directly, missing split auth-server setups.
        const calledUrls: string[] = [];
        const handler = buildHandler({
          discoverOAuthProtectedResourceMetadata: async () =>
            ({
              resource: TEST_URL,
              authorization_servers: ["https://auth.example.com"],
            }) as Awaited<
              ReturnType<
                OAuthDiscovery["discoverOAuthProtectedResourceMetadata"]
              >
            >,
          discoverAuthorizationServerMetadata: async (url) => {
            calledUrls.push(url.toString());
            return undefined;
          },
        });

        await handler.probeOAuthSupport(TEST_URL);
        expect(calledUrls).toEqual(["https://auth.example.com"]);
      });

      it("falls back to auth-server metadata when protected-resource discovery throws", async () => {
        const handler = buildHandler({
          discoverOAuthProtectedResourceMetadata: async () => {
            throw new Error("404 Not Found");
          },
          discoverAuthorizationServerMetadata: async () =>
            ({
              issuer: "https://auth.example.com",
              authorization_endpoint: "https://auth.example.com/authorize",
              response_types_supported: ["code"],
            }) as Awaited<
              ReturnType<OAuthDiscovery["discoverAuthorizationServerMetadata"]>
            >,
        });

        expect(await handler.probeOAuthSupport(TEST_URL)).toBe(true);
      });

      it("returns false when both discovery calls throw (non-OAuth server)", async () => {
        const handler = buildHandler({
          discoverOAuthProtectedResourceMetadata: async () => {
            throw new Error("404 Not Found");
          },
          discoverAuthorizationServerMetadata: async () => {
            throw new Error("404 Not Found");
          },
        });

        expect(await handler.probeOAuthSupport(TEST_URL)).toBe(false);
      });

      it("returns false when protected-resource throws and auth-server returns undefined", async () => {
        const handler = buildHandler({
          discoverOAuthProtectedResourceMetadata: async () => {
            throw new Error("404 Not Found");
          },
          discoverAuthorizationServerMetadata: async () => undefined,
        });

        expect(await handler.probeOAuthSupport(TEST_URL)).toBe(false);
      });
    });

    describe(".safeTryWithExistingTokens", () => {
      const remoteServer = {
        name: TEST_SERVER_NAME,
        type: "streamable-http" as const,
        url: "https://example.com",
      };

      it("returns undefined and does NOT create a provider when no in-session provider and no persisted tokens exist", async () => {
        // RND-483 Bug 2: prior impl created a DCR provider unconditionally,
        // which made every 401 look like an OAuth handshake.
        const provider = createMockProvider();
        let getOrCreateCalled = false;
        const sessionManager: OAuthSessionManagerI = {
          ...createMockSessionManager(provider),
          getExistingOAuthProvider: () => undefined,
          hasPersistedOAuthTokens: async () => false,
          getOrCreateOAuthProvider: () => {
            getOrCreateCalled = true;
            return provider;
          },
        };
        const handler = new OAuthConnectionHandler(
          sessionManager,
          createMockExtendedClientBuilder(),
          noOpLogger,
        );

        const result = await handler.safeTryWithExistingTokens(remoteServer);
        expect(result).toBeUndefined();
        expect(getOrCreateCalled).toBe(false);
      });

      it("rehydrates a provider from persisted tokens when in-session provider is missing", async () => {
        // Restart case: provider map empty, tokens still on disk.
        const provider = createMockProvider({ tokens: async () => undefined });
        let getOrCreateCalled = false;
        const sessionManager: OAuthSessionManagerI = {
          ...createMockSessionManager(provider),
          getExistingOAuthProvider: () => undefined,
          hasPersistedOAuthTokens: async () => true,
          getOrCreateOAuthProvider: () => {
            getOrCreateCalled = true;
            return provider;
          },
        };
        const handler = new OAuthConnectionHandler(
          sessionManager,
          createMockExtendedClientBuilder(),
          noOpLogger,
        );

        await handler.safeTryWithExistingTokens(remoteServer);
        expect(getOrCreateCalled).toBe(true);
      });

      it("returns undefined (does not throw) when the token store is unreachable", async () => {
        // RND-483: hasPersistedOAuthTokens is a hub round-trip in enterprise.
        // A hub disconnect must not escape this "safe" method — it should be
        // treated like any transient error: preserve state, return undefined.
        const provider = createMockProvider();
        let getOrCreateCalled = false;
        const sessionManager: OAuthSessionManagerI = {
          ...createMockSessionManager(provider),
          getExistingOAuthProvider: () => undefined,
          hasPersistedOAuthTokens: async () => {
            throw new Error("Hub not connected");
          },
          getOrCreateOAuthProvider: () => {
            getOrCreateCalled = true;
            return provider;
          },
        };
        const handler = new OAuthConnectionHandler(
          sessionManager,
          createMockExtendedClientBuilder(),
          noOpLogger,
        );

        const result = await handler.safeTryWithExistingTokens(remoteServer);
        expect(result).toBeUndefined();
        expect(getOrCreateCalled).toBe(false);
      });
    });

    describe(".resolveExistingAuth", () => {
      const remoteServer = {
        name: TEST_SERVER_NAME,
        type: "streamable-http" as const,
        url: "https://example.com",
      };

      // Stub safeTryWithExistingTokens (its own suite covers it, and it does
      // real transport I/O) to isolate the classification logic. Other signals
      // run for real via the session-manager / discovery mocks.
      function buildHandler(opts: {
        reuseSucceeds?: boolean;
        hasContext?: boolean;
        tokensValid?: boolean;
        advertisesOAuth?: boolean;
      }): { handler: OAuthConnectionHandler; client: ExtendedClientI } {
        const provider = createMockProvider({
          tokens: async () =>
            opts.tokensValid
              ? ({ access_token: "t", token_type: "Bearer" } as OAuthTokens)
              : undefined,
        });
        const sessionManager: OAuthSessionManagerI = {
          ...createMockSessionManager(provider),
          hasOAuthProvider: () => Boolean(opts.hasContext),
          getExistingOAuthProvider: () =>
            opts.hasContext ? provider : undefined,
        };
        const discovery: OAuthDiscovery = {
          discoverOAuthProtectedResourceMetadata: async () => {
            if (!opts.advertisesOAuth) throw new Error("404 Not Found");
            return {
              resource: remoteServer.url,
              authorization_servers: [],
            } as Awaited<
              ReturnType<
                OAuthDiscovery["discoverOAuthProtectedResourceMetadata"]
              >
            >;
          },
          discoverAuthorizationServerMetadata: async () => undefined,
        };
        const handler = new OAuthConnectionHandler(
          sessionManager,
          createMockExtendedClientBuilder(),
          noOpLogger,
          discovery,
        );
        const client = { close: async () => {} } as unknown as ExtendedClientI;
        jest
          .spyOn(handler, "safeTryWithExistingTokens")
          .mockResolvedValue(opts.reuseSucceeds ? client : undefined);
        return { handler, client };
      }

      it("returns connected when stored tokens reconnect successfully", async () => {
        const { handler, client } = buildHandler({ reuseSucceeds: true });
        const verdict = await handler.resolveExistingAuth(remoteServer);
        expect(verdict).toEqual({ kind: "connected", client });
      });

      it("returns not-oauth when reuse fails and the server advertises no OAuth metadata", async () => {
        const { handler } = buildHandler({
          reuseSucceeds: false,
          hasContext: false,
          advertisesOAuth: false,
        });
        const verdict = await handler.resolveExistingAuth(remoteServer);
        expect(verdict.kind).toBe("not-oauth");
      });

      it("returns needs-auth when the server advertises OAuth but has no prior context", async () => {
        const { handler } = buildHandler({
          reuseSucceeds: false,
          hasContext: false,
          advertisesOAuth: true,
        });
        const verdict = await handler.resolveExistingAuth(remoteServer);
        expect(verdict.kind).toBe("needs-auth");
      });

      it("returns unreachable for an OAuth context whose tokens are still valid", async () => {
        const { handler } = buildHandler({
          reuseSucceeds: false,
          hasContext: true,
          tokensValid: true,
        });
        const verdict = await handler.resolveExistingAuth(remoteServer);
        expect(verdict.kind).toBe("unreachable");
      });

      it("returns needs-auth for an OAuth context whose tokens are expired/rejected", async () => {
        const { handler } = buildHandler({
          reuseSucceeds: false,
          hasContext: true,
          tokensValid: false,
        });
        const verdict = await handler.resolveExistingAuth(remoteServer);
        expect(verdict.kind).toBe("needs-auth");
      });
    });
  });
});
