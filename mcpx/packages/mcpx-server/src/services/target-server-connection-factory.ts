import { loggableError } from "@mcpx/toolkit-core/logging";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { Logger } from "winston";
import { FailedToConnectToTargetServer } from "../errors.js";
import { prepareCommand } from "../interception.js";
import {
  EnvValue,
  RemoteTargetServer,
  StdioTargetServer,
  TargetServer,
} from "../model/target-servers.js";
import { ExtendedClientBuilder, ExtendedClientI } from "./client-extension.js";
import { DockerService } from "./docker.js";
import { env } from "../env.js";

/**
 * Resolves env values, looking up fromEnv references in process.env.
 * Missing env vars are skipped (not passed to child process) with a warning.
 */
export function resolveEnvValues(
  envConfig: Record<string, EnvValue>,
  logger: Logger,
): Record<string, string> {
  return Object.entries(envConfig).reduce<Record<string, string>>(
    (resolved, [key, value]) => {
      if (typeof value === "string") {
        resolved[key] = value;
      } else {
        const envVarValue = process.env[value.fromEnv];
        if (envVarValue !== undefined) {
          resolved[key] = envVarValue;
        } else {
          logger.warn("Environment variable referenced by fromEnv not found", {
            targetEnvKey: key,
            referencedEnvVar: value.fromEnv,
          });
        }
      }
      return resolved;
    },
    {},
  );
}

/**
 * Factory for creating connections to different types of target MCP servers
 */
export class TargetServerConnectionFactory {
  constructor(
    private extendedClientBuilder: ExtendedClientBuilder,
    private dockerService: DockerService,
    private logger: Logger,
  ) {
    this.logger = logger.child({ component: "ConnectionFactory" });
  }

  /**
   * Creates a connection to a target server based on its type.
   * Note that these connections might fail, for any reason (auth or another),
   * returning a failed Promise.
   * It is the caller's responsibility to handle these errors.
   */
  async createConnection(targetServer: TargetServer): Promise<ExtendedClientI> {
    switch (targetServer.type) {
      case "stdio":
        return await this.createStdioConnection(targetServer);
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
  ): Promise<ExtendedClientI> {
    const { command, args } = await prepareCommand(
      targetServer,
      this.dockerService,
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

    const resolvedEnv = resolveEnvValues(targetServer.env, this.logger);
    const childEnv = env.STDIO_INHERIT_PROCESS_ENV
      ? ({ ...process.env, ...resolvedEnv } as Record<string, string>)
      : resolvedEnv;
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
    const { tools } = await extendedClient.listTools();
    this.logger.info("STDIO client connected", {
      name: targetServer.name,
      command,
      args,
      tools: tools.map(({ name }) => name),
    });

    return extendedClient;
  }

  private async createRemoteConnection(
    targetServer: RemoteTargetServer,
  ): Promise<ExtendedClientI> {
    const client = buildClient(targetServer.name);
    const requestInit: RequestInit = { headers: targetServer.headers };
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
