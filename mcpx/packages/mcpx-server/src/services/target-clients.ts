import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "fs";
import path from "path";
import { Logger } from "winston";
import { prepareCommand } from "../interception.js";
import { TargetServer, targetServerConfigSchema } from "../model.js";
import {
  AlreadyExistsError,
  FailedToConnectToTargetServer,
  NotFoundError,
} from "../errors.js";
import { SystemStateTracker } from "./system-state.js";
import { loggableError } from "@mcpx/toolkit-core/logging";
import { env } from "../env.js";

export class TargetClients {
  private _clientsByService: Map<string, Client> = new Map();
  private targetServers: TargetServer[] = [];

  private systemState: SystemStateTracker;
  private logger: Logger;
  private initialized = false;

  constructor(metricRecorder: SystemStateTracker, logger: Logger) {
    this.systemState = metricRecorder;
    this.logger = logger.child({ service: "TargetClients" });
  }

  async initialize(): Promise<void> {
    this.targetServers = this.readTargetServers();
    await this.loadClients();
    this.initialized = true;
  }

  get clientsByService(): Map<string, Client> {
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
    const client = await this.initiateClient(targetServer);
    if (client) {
      this._clientsByService.set(targetServer.name, client);
      this.logger.info("Client added", { name: targetServer.name });
    } else {
      this.logger.error("Failed to add client", {
        targetServer: { name: targetServer.name },
      });
      return Promise.reject(new FailedToConnectToTargetServer());
    }
  }

  private async loadClients(): Promise<void> {
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
        this.initiateClient(server).then((client) => {
          if (!client) {
            return;
          }
          this._clientsByService.set(server.name, client);
        }),
      ),
    );
  }

  private async initiateClient(
    targetServer: TargetServer,
  ): Promise<Client | undefined> {
    const { command, args } = await prepareCommand(targetServer);
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
      const { tools } = await client.listTools();
      this.logger.info("Client connected", {
        name: targetServer.name,
        command,
        args,
        tools: tools.map(({ name }) => name),
      });
      this.systemState.recordTargetServerConnected({
        name: targetServer.name,
        tools,
      });
      return client;
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
}
