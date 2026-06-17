import { compactRecord } from "@mcpx/toolkit-core/data";
import { loggableError } from "@mcpx/toolkit-core/logging";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { Logger } from "winston";
import {
  FailedToConnectToTargetServer,
  PendingInputError,
  STDIO_SERVERS_DISABLED_MESSAGE,
} from "../errors.js";
import { prepareCommand } from "../interception.js";
import {
  RemoteTargetServer,
  StdioTargetServer,
  TargetServer,
} from "../model/target-servers.js";
import { ExtendedClientBuilder, ExtendedClientI } from "./client-extension.js";
import { env } from "../env.js";
import { TargetServerEnvSource } from "./env-var-manager.js";
import { IdentityServiceI } from "./identity-service.js";
import { EnvRequirements } from "@mcpx/shared-model";
import { resolveEnv } from "./target-server-env-resolution.js";

/**
 * Factory for creating connections to different types of target MCP servers
 */
export class TargetServerConnectionFactory {
  constructor(
    private extendedClientBuilder: ExtendedClientBuilder,
    private logger: Logger,
    private identityService: IdentityServiceI,
    private envVars: TargetServerEnvSource,
  ) {
    this.logger = logger.child({ component: "ConnectionFactory" });
  }

  /**
   * Creates a connection to a target server based on its type.
   * Note that these connections might fail, for any reason (auth or another),
   * returning a failed Promise.
   * It is the caller's responsibility to handle these errors.
   */
  async createConnection(
    targetServer: TargetServer,
    envRequirements: EnvRequirements | undefined,
  ): Promise<ExtendedClientI> {
    switch (targetServer.type) {
      case "stdio":
        return await this.createStdioConnection(targetServer, envRequirements);
      case "sse":
        return await this.createRemoteConnection(targetServer);
      case "streamable-http":
        return await this.createRemoteConnection(targetServer);
    }
  }

  /**
   * Creates a connection to a STDIO target server
   */
  private async createStdioConnection(
    targetServer: StdioTargetServer,
    envRequirements: EnvRequirements | undefined,
  ): Promise<ExtendedClientI> {
    // Backstop for the config-validation gate: blocks any stdio spawn (incl.
    // servers applied from the Hub setup) when the policy flag is off.
    if (!env.ENABLE_STDIO_MCP_SERVERS) {
      return Promise.reject(
        new FailedToConnectToTargetServer(STDIO_SERVERS_DISABLED_MESSAGE),
      );
    }

    const { resolved: resolvedEnv, missingVars } = resolveEnv({
      envConfig: targetServer.env,
      envVarsResolver: this.envVars,
      logger: this.logger,
      envRequirements,
    });

    if (missingVars.length > 0 && !this.identityService.isSpace()) {
      throw new PendingInputError(missingVars);
    }

    const { command, args } = await prepareCommand(
      targetServer,
      resolvedEnv,
    ).catch((error) => {
      const { env: _env, ...safeTargetServer } = targetServer;
      this.logger.error("Failed to prepare command", {
        targetServer: safeTargetServer,
        error: loggableError(error),
      });

      // If the error is already a FailedToConnectToTargetServer, preserve its message
      if (error instanceof FailedToConnectToTargetServer) {
        return Promise.reject(error);
      }
      // For other errors, enhance with user-friendly recovery instructions
      const enhancedError = new FailedToConnectToTargetServer(
        `Failed to prepare command for server "${targetServer.name}". This usually means the command or Docker image is not available.`,
      );
      return Promise.reject(enhancedError);
    });

    if (command === undefined) {
      return Promise.reject(
        new FailedToConnectToTargetServer(
          `Failed to prepare command for server "${targetServer.name}". The command is missing or invalid. Please check your server configuration.`,
        ),
      );
    }
    if (args === undefined) {
      return Promise.reject(
        new FailedToConnectToTargetServer(
          `Failed to prepare command arguments for server "${targetServer.name}". The arguments are missing or invalid. Please check your server configuration.`,
        ),
      );
    }

    const mcpxAuthEnv = compactRecord({
      JWKS_URI: env.MCPX_AUTH_JWKS_URI,
      JWT_ISSUER: env.MCPX_AUTH_JWT_ISSUER,
      JWT_AUDIENCE: env.MCPX_AUTH_JWT_AUDIENCE,
    });
    const childEnv = env.STDIO_INHERIT_PROCESS_ENV
      ? ({
          ...process.env,
          ...this.envVars.getTargetServerEnv(),
          ...mcpxAuthEnv,
          ...resolvedEnv,
        } as Record<string, string>)
      : { ...mcpxAuthEnv, ...resolvedEnv };
    const transport = new StdioClientTransport({
      command,
      args,
      env: childEnv,
    });

    const client = buildClient(targetServer.name);
    const extendedClient = await this.connectAndExtendClient(
      targetServer.name,
      client,
      transport,
    );
    this.logger.info("STDIO client connected", {
      name: targetServer.name,
      command,
      args,
    });

    return extendedClient;
  }

  private async createRemoteConnection(
    targetServer: RemoteTargetServer,
  ): Promise<ExtendedClientI> {
    const client = buildClient(targetServer.name);

    let resolvedHeaders: Record<string, string> | undefined;
    if (targetServer.headers) {
      const { resolved, missingVars } = resolveEnv({
        envConfig: targetServer.headers,
        envVarsResolver: this.envVars,
        logger: this.logger,
      });
      if (missingVars.length > 0 && !this.identityService.isSpace()) {
        throw new PendingInputError(missingVars);
      }
      resolvedHeaders = resolved;
    }

    const requestInit: RequestInit = { headers: resolvedHeaders };
    try {
      const transport =
        targetServer.type === "sse"
          ? new SSEClientTransport(new URL(targetServer.url), { requestInit })
          : new StreamableHTTPClientTransport(new URL(targetServer.url), {
              requestInit,
            });
      const extendedClient = await this.connectAndExtendClient(
        targetServer.name,
        client,
        transport,
      );
      this.logger.info("Client connected", {
        name: targetServer.name,
        url: targetServer.url,
        type: targetServer.type,
      });

      return extendedClient;
    } catch (e) {
      return Promise.reject(e);
    }
  }

  /**
   * Connects a client using the provided transport and extends it
   */
  private async connectAndExtendClient(
    targetServerName: string,
    client: Client,
    transport: Transport,
  ): Promise<ExtendedClientI> {
    await client.connect(transport, { timeout: env.CONNECTION_TIMEOUT_MS });
    const extendedClient = await this.extendedClientBuilder.build({
      name: targetServerName,
      originalClient: client,
    });
    return extendedClient;
  }
}

export function buildClient(targetServiceName: string): Client {
  return new Client({
    name: `mcpx::${targetServiceName}`,
    version: "1.0.0",
  });
}
