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
  SSETargetServer,
  StdioTargetServer,
  StreamableHttpTargetServer,
  TargetServer,
} from "../model/target-servers.js";
import { ExtendedClientBuilder, ExtendedClientI } from "./client-extension.js";
import { DockerService } from "./docker.js";

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
      this.logger.error("Failed to prepare command", {
        targetServer,
        error: loggableError(error),
      });
      return { command: undefined, args: undefined };
    });

    if (command === undefined) {
      return Promise.reject(
        new FailedToConnectToTargetServer("missing command"),
      );
    }
    if (args === undefined) {
      return Promise.reject(new FailedToConnectToTargetServer("missing args"));
    }

    const env = { ...process.env, ...targetServer.env } as Record<
      string,
      string
    >;
    const transport = new StdioClientTransport({
      command,
      args,
      env,
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
    targetServer: StreamableHttpTargetServer | SSETargetServer,
  ): Promise<ExtendedClientI> {
    const client = buildClient(targetServer.name);

    try {
      const transport =
        targetServer.type === "sse"
          ? new SSEClientTransport(new URL(targetServer.url))
          : new StreamableHTTPClientTransport(new URL(targetServer.url));
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
    await client.connect(transport);
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
