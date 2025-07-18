import { loggableError } from "@mcpx/toolkit-core/logging";
import { withPolling } from "@mcpx/toolkit-core/time";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Logger } from "winston";
import { env } from "../env.js";
import { SSETargetServer, StreamableHttpTargetServer } from "../model.js";
import { McpxOAuthProviderI } from "../server/oauth-provider.js";
import { OAuthSessionManagerI } from "../server/oauth-session-manager.js";
import {
  ExtendedClientBuilderI,
  ExtendedClientI,
  OriginalClientI,
} from "./client-extension.js";
import { buildClient } from "./target-server-connection-factory.js";

const OAUTH_POLLING_INTERVAL_MS = 1000;

/**
 * Handles OAuth authentication flows for target server connections
 */
export class OAuthConnectionHandler {
  constructor(
    private oauthSessionManager: OAuthSessionManagerI,
    private extendedClientBuilder: ExtendedClientBuilderI,
    private logger: Logger,
  ) {
    this.logger = logger.child({ component: "OAuthConnectionHandler" });
  }

  /**
   * Tries to connect to a target server using existing OAuth tokens if available,
   * if not available or if they fail, will return `undefined`.
   */
  async safeTryWithExistingTokens(
    targetServer: SSETargetServer | StreamableHttpTargetServer,
  ): Promise<ExtendedClientI | undefined> {
    const targetServerTypeStr =
      targetServer.type === "sse" ? "SSE" : "StreamableHTTP";

    // Get OAuth provider from session manager (coordinated flow)
    const authProvider = this.oauthSessionManager.getOrCreateOAuthProvider(
      targetServer.name,
    );

    // Check if we already have valid tokens
    const existingTokens = await authProvider.tokens();
    if (!existingTokens) {
      return undefined;
    }
    this.logger.info("Found existing tokens, attempting to use them", {
      name: targetServer.name,
    });

    // Create transport with existing auth provider
    const transport =
      targetServer.type === "sse"
        ? new SSEClientTransport(new URL(targetServer.url), {
            authProvider,
          })
        : new StreamableHTTPClientTransport(new URL(targetServer.url), {
            authProvider,
          });

    // Try to use the existing tokens
    try {
      // If successful, create and return the client
      const client = buildClient(targetServer.name);
      await client.connect(transport);

      const extendedClient = await this.extendedClientBuilder.build({
        name: targetServer.name,
        originalClient: client,
      });

      this.logger.info(
        `${targetServerTypeStr} Client connected with existing OAuth tokens`,
        {
          name: targetServer.name,
          url: targetServer.url,
          tools: await extendedClient.listTools(),
        },
      );

      return extendedClient;
    } catch (error) {
      this.logger.info(
        "Existing tokens failed, proceeding with new OAuth flow",
        {
          name: targetServer.name,
          error: loggableError(error),
        },
      );
      return undefined;
    }
  }
  /**
   * Retries a connection with OAuth authentication
   */
  async tryWithOAuth(
    targetServer: SSETargetServer | StreamableHttpTargetServer,
    client: OriginalClientI,
  ): Promise<ExtendedClientI> {
    const targetServerTypeStr =
      targetServer.type === "sse" ? "SSE" : "StreamableHTTP";

    // Get OAuth provider from session manager (coordinated flow)
    const authProvider = this.oauthSessionManager.getOrCreateOAuthProvider(
      targetServer.name,
    );

    // Register the OAuth flow state for callback coordination
    const state = authProvider.state();
    this.oauthSessionManager.startOAuthFlow(targetServer.name, state);

    this.logger.info("Starting OAuth-enabled transport", {
      name: targetServer.name,
    });

    // Create transport with auth provider - this will trigger OAuth flow
    const transport =
      targetServer.type === "sse"
        ? new SSEClientTransport(new URL(targetServer.url), { authProvider })
        : new StreamableHTTPClientTransport(new URL(targetServer.url), {
            authProvider,
          });

    // When we start the transport, it will trigger the OAuth flow.
    // It will fail since we don't have the authorization code yet,
    // but we catch the error to continue the flow.
    await transport.start().catch((_e: unknown) => {
      this.logger.debug("expected transport.start() error, continuing");
    });

    if (targetServer.type === "streamable-http") {
      // Hack inspired by `mcp-remote`
      const testTransport = new StreamableHTTPClientTransport(
        new URL(targetServer.url),
        { authProvider },
      );
      const testClient = new Client(
        { name: "mcpx-fallback-test", version: "0.0.0" },
        { capabilities: {} },
      );
      await testClient.connect(testTransport).catch((_e: unknown) => {
        this.logger.debug(
          "expected client.connect() error on mcpx-fallback-test, continuing",
          { error: loggableError(_e) },
        );
      });
    }

    // Poll for authorization code
    const authCode = await this.pollForAuthorizationCode(authProvider);

    if (!authCode) {
      throw new Error("Failed to obtain authorization code");
    }

    await transport.finishAuth(authCode);
    const postAuthTransport =
      targetServer.type === "sse"
        ? new SSEClientTransport(new URL(targetServer.url), { authProvider })
        : new StreamableHTTPClientTransport(new URL(targetServer.url), {
            authProvider,
          });

    await client.connect(postAuthTransport);

    const extendedClient = await this.extendedClientBuilder.build({
      name: targetServer.name,
      originalClient: client,
    });

    this.logger.info(`${targetServerTypeStr} Client connected with OAuth`, {
      name: targetServer.name,
      url: targetServer.url,
      tools: await extendedClient.listTools(),
    });

    return extendedClient;
  }

  /**
   * Polls for the authorization code from the OAuth provider
   */
  private async pollForAuthorizationCode(
    authProvider: McpxOAuthProviderI,
  ): Promise<string | null> {
    return withPolling({
      maxAttempts: env.OAUTH_TIMEOUT_SECONDS,
      sleepTimeMs: OAUTH_POLLING_INTERVAL_MS,
      getValue: () => authProvider.getAuthorizationCode(),
      found: (code): code is string => Boolean(code),
    });
  }
}

/**
 * Checks if an error indicates OAuth authentication is required
 */
export function isAuthenticationError(error: unknown): boolean {
  if (typeof error === "object" && error !== null) {
    const err = error as Record<string, unknown>;
    return (
      (err?.["response"] as Record<string, unknown>)?.["status"] === 401 ||
      err?.["status"] === 401 ||
      err?.["code"] === 401 ||
      (typeof err?.["message"] === "string" &&
        err["message"].includes("401")) ||
      (typeof err?.["message"] === "string" &&
        err["message"].includes("Unauthorized"))
    );
  }
  return false;
}
