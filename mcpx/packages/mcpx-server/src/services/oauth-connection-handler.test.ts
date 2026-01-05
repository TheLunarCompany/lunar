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
      };
    }

    function createMockExtendedClientBuilder(): ExtendedClientBuilderI {
      return {
        build: async () =>
          ({
            close: async () => {},
            listTools: async () => ({ tools: [] }),
            originalTools: async () => Promise.resolve({ tools: [] }),
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

    // Note: initiateOAuth is difficult to unit test because it creates real
    // transport instances that attempt network connections. Full integration
    // testing of the two-phase flow is covered by oauth.it.test.ts.
    // The key behaviors (storing pending flows, returning auth URL) are
    // implicitly tested through the IT tests.
  });
});
