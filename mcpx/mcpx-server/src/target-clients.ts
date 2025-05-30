import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "fs";
import path from "path";
import { Logger } from "winston";
import { prepareCommand } from "./interception.js";
import { TargetServer, targetServerConfigSchema } from "./model.js";
import { loggableError } from "./utils.js";

const SERVERS_CONFIG_PATH =
  process.env["SERVERS_CONFIG_PATH"] || "config/mcp.json";

export class TargetClients {
  private _clientsByService: Map<string, Client> = new Map();
  private targetServers: TargetServer[] = [];
  private logger: Logger;
  private initialized = false;

  constructor(logger: Logger) {
    this.logger = logger;
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

  async loadClients(): Promise<void> {
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
    const { command, args } = prepareCommand(targetServer);
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
    const configPath = path.resolve(SERVERS_CONFIG_PATH);
    const file = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(file);
    const parsed = targetServerConfigSchema.parse(config);
    if (Object.keys(parsed.mcpServers).length === 0) {
      throw new Error("No servers found in config");
    }

    return Object.entries(parsed.mcpServers).map(([name, config]) => ({
      name,
      ...config,
    }));
  }
}
