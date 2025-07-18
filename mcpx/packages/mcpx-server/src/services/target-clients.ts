import { loggableError } from "@mcpx/toolkit-core/logging";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "fs";
import path from "path";
import { Logger } from "winston";
import { env } from "../env.js";
import {
  AlreadyExistsError,
  FailedToConnectToTargetServer,
  NotFoundError,
} from "../errors.js";
import { prepareCommand } from "../interception.js";
import { TargetServer, targetServerConfigSchema } from "../model.js";
import { ExtendedClient, ExtendedClientBuilder } from "./client-extension.js";
import { DockerService } from "./docker.js";
import { SystemStateTracker } from "./system-state.js";

// This class manages connections to target MCP servers, via initializing
// `Client` instances, extending them into `ExtendedClient` instances,
// storing them in a map, and providing methods to add, remove, and list clients.
export class TargetClients {
  private _clientsByService: Map<string, ExtendedClient> = new Map();
  private targetServers: TargetServer[] = [];
  private initialized = false;

  constructor(
    private systemState: SystemStateTracker,
    private extendedClientBuilder: ExtendedClientBuilder,
    private dockerService: DockerService,
    private logger: Logger,
  ) {
    this.logger = logger.child({ service: "TargetClients" });
  }

  async initialize(): Promise<void> {
    if (env.READ_TARGET_SERVERS_FROM_FILE) {
      this.targetServers = this.readTargetServers();
    }
    await this.reloadClients();
    this.initialized = true;
  }

  get clientsByService(): Map<string, ExtendedClient> {
    if (!this.initialized) {
      throw new Error("TargetClients not initialized");
    }
    return this._clientsByService;
  }

  shutdown(): void {
    this.logger.info("Shutting down TargetClients...");

    // Close all clients
    this._clientsByService.forEach((client, name) => {
      client
        .close()
        .then(() => {
          this.logger.info("Client closed", { name });
        })
        .catch((e: unknown) => {
          const error = loggableError(e);
          this.logger.error("Error closing client", { name, error });
        });
    });
  }

  getTargetServer(name: string): TargetServer | undefined {
    if (!this.initialized) {
      throw new Error("TargetClients not initialized");
    }
    return this.targetServers.find((server) => server.name === name);
  }

  async removeClient(name: string): Promise<void> {
    const client = this._clientsByService.get(name);
    if (!client) {
      this.logger.warn("Client not found", { name });
      return Promise.reject(new NotFoundError());
    }
    try {
      await client.close();
      this._clientsByService.delete(name);
      this.targetServers = this.targetServers.filter(
        (server) => server.name !== name,
      );
      this.writeTargetServers(this.targetServers);
      this.systemState.recordTargetServerDisconnected({ name });
      this.logger.info("Client removed", { name });
    } catch (e: unknown) {
      const error = loggableError(e);
      this.logger.error("Error removing client", { name, error });
    }
  }

  async addClient(targetServer: TargetServer): Promise<void> {
    if (this._clientsByService.has(targetServer.name)) {
      this.logger.warn("Client already exists", { name: targetServer.name });
      return Promise.reject(new AlreadyExistsError());
    }
    this.targetServers.push(targetServer);
    const client = await this.safeInitiateClient(
      targetServer,
      this.dockerService,
    );
    if (client) {
      this.writeTargetServers(this.targetServers);
      this._clientsByService.set(targetServer.name, client);
      this.logger.info("Client added", { name: targetServer.name });
    } else {
      this.logger.error("Failed to add client", {
        targetServer: { name: targetServer.name },
      });
      return Promise.reject(new FailedToConnectToTargetServer());
    }
  }

  async reloadClients(): Promise<void> {
    // Disconnect all clients before reloading
    await Promise.all(
      Array.from(this._clientsByService.entries()).map(([name, client]) => {
        return client
          .close()
          .then(() => {
            this._clientsByService.delete(name);
            this.logger.info("Client closed", { name });
          })
          .catch((e: unknown) => {
            const error = loggableError(e);
            this.logger.error("Error closing client", {
              name,
              error,
            });
          });
      }),
    );
    if (this._clientsByService.size !== 0) {
      this.logger.warn("Some clients were not closed properly", {
        clients: Array.from(this._clientsByService.keys()),
      });
      this._clientsByService.clear();
    }
    // Reconnect to all target servers
    await Promise.all(
      this.targetServers.map((server) =>
        this.safeInitiateClient(server, this.dockerService).then((client) => {
          if (!client) {
            return;
          }
          this._clientsByService.set(server.name, client);
        }),
      ),
    );
  }

  // This method initiates a STDIO transport to the target server,
  // prepares the command and arguments, and connects to the server.
  // Will return `ExtendedClient` if connection is successful,
  // or `undefined` if there was an error during connection - it does not throw.
  private async safeInitiateClient(
    targetServer: TargetServer,
    dockerService: DockerService,
  ): Promise<ExtendedClient | undefined> {
    const { command, args } = await prepareCommand(
      targetServer,
      dockerService,
    ).catch((error) => {
      this.logger.error("Failed to prepare command", {
        name: targetServer.name,
        command: targetServer.command,
        args: targetServer.args,
        error: loggableError(error),
      });
      return { command: undefined, args: undefined };
    });

    if (command === undefined || args === undefined) {
      return undefined;
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

    const client = new Client({ name: targetServer.name, version: "1.0.0" });
    try {
      await client.connect(transport);
      // from this point on, we switch to working with the extended client only
      const extendedClient = this.extendedClientBuilder.build({
        name: targetServer.name,
        originalClient: client,
      });
      const { tools } = await extendedClient.listTools();
      const { tools: originalTools } = await extendedClient.originalTools();
      this.logger.info("Client connected", {
        name: targetServer.name,
        command,
        args,
        tools: tools.map(({ name }) => name),
      });
      this.systemState.recordTargetServerConnected({
        args: targetServer.args,
        command: targetServer.command,
        env: targetServer.env,
        icon: targetServer.icon,
        name: targetServer.name,
        originalTools,
        tools,
      });
      return extendedClient;
    } catch (error) {
      this.logger.error("Error connecting to client", {
        name: targetServer.name,
        command,
        args,
        error,
      });
      return undefined;
    }
  }

  private readTargetServers(): TargetServer[] {
    try {
      const configPath = path.resolve(env.SERVERS_CONFIG_PATH);
      const file = fs.readFileSync(configPath, "utf8");
      const config = JSON.parse(file);
      const parsed = targetServerConfigSchema.parse(config);

      return Object.entries(parsed.mcpServers).map(([name, config]) => ({
        name,
        ...config,
      }));
    } catch (e: unknown) {
      const error = loggableError(e);
      this.logger.error("Failed to read target servers config", error);

      return [];
    }
  }

  private writeTargetServers(servers: TargetServer[]): void {
    try {
      const config = targetServerConfigSchema.parse({
        mcpServers: Object.fromEntries(
          servers.map((server) => [server.name, server]),
        ),
      });
      const configPath = path.resolve(env.SERVERS_CONFIG_PATH);
      const configDir = path.dirname(configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      this.logger.info("Updated target servers config", { configPath });
    } catch (e: unknown) {
      const error = loggableError(e);
      this.logger.error("Failed to write target servers config", { error });
      throw error;
    }
  }
}
