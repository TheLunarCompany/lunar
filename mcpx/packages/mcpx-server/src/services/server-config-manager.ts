import { loggableError } from "@mcpx/toolkit-core/logging";
import fs from "fs";
import path from "path";
import { Logger } from "winston";
import {
  TargetServer,
  targetServerConfigSchema,
} from "../model/target-servers.js";

/**
 * Manages reading and writing of target server configurations from/to disk
 */
export class ServerConfigManager {
  constructor(
    private configPath: string,
    private logger: Logger,
  ) {
    this.logger = logger.child({ component: "ServerConfigManager" });
  }

  /**
   * Reads target servers configuration from disk
   */
  readTargetServers(): TargetServer[] {
    try {
      const file = fs.readFileSync(this.configPath, "utf8");
      const config = JSON.parse(file);
      const parsed = targetServerConfigSchema.parse(config);

      return Object.entries(parsed.mcpServers).map(([name, config]) => ({
        name,
        ...config,
      }));
    } catch (e: unknown) {
      const error = loggableError(e);

      // Log file not found errors as debug, other errors as error
      if (e instanceof Error && "code" in e && e.code === "ENOENT") {
        this.logger.debug("Target servers config file not found", error);
      } else {
        this.logger.error("Failed to read target servers config", error);
      }
      return [];
    }
  }

  /**
   * Writes target servers configuration to disk
   */
  writeTargetServers(servers: TargetServer[]): void {
    try {
      const config = targetServerConfigSchema.parse({
        mcpServers: Object.fromEntries(
          servers.map((server) => [server.name, server]),
        ),
      });

      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      this.logger.info("Updated target servers config", {
        configPath: this.configPath,
      });
    } catch (e: unknown) {
      const error = loggableError(e);
      this.logger.error("Failed to write target servers config", { error });
      throw error;
    }
  }

  /**
   * Gets the configuration file path
   */
  getConfigPath(): string {
    return this.configPath;
  }
}
