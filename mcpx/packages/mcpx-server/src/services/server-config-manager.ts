import { makeError } from "@mcpx/toolkit-core/data";
import fs from "fs";
import path from "path";
import { Logger } from "winston";
import { z } from "zod/v4";
import {
  TargetServer,
  targetServerConfigSchema,
} from "../model/target-servers.js";
import { InvalidSchemaError } from "../errors.js";
import { loggableError } from "@mcpx/toolkit-core/logging";
import { env } from "../env.js";

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
      const error = makeError(e);

      // Log file not found errors as debug, other errors as error
      if (e instanceof Error && "code" in e && e.code === "ENOENT") {
        this.logger.debug("Target servers config file not found", error);
      } else if (e instanceof SyntaxError) {
        // Handle JSON parsing errors specifically
        this.logger.error(
          "Error parsing target server config. Invalid JSON format:",
          {
            errorName: error.name,
            errorMessage: e.message,
            configPath: this.configPath,
          },
        );
        throw new InvalidSchemaError(
          `Configuration file "${env.SERVERS_CONFIG_PATH}" has an invalid JSON format: ${e.message}`,
        );
      } else if (e instanceof z.ZodError) {
        // For Zod validation errors, create a simple user-friendly message
        const userFriendlyMessage = z.prettifyError(e);

        this.logger.error(
          "Failed to read target servers config - Validation Error:",
          {
            errorName: error.name,
            errorMessage: e.message,
            configPath: this.configPath,
          },
        );
        throw new InvalidSchemaError(
          `Configuration validation failed: ${userFriendlyMessage}`,
        );
      } else {
        // For other errors
        this.logger.error("Failed to read target servers config", error);
        throw new InvalidSchemaError(
          `Error reading target server config: ${error.message}`,
        );
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
