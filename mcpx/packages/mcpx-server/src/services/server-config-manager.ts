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

export interface ServerConfigManager {
  readTargetServers(): TargetServer[];
  writeTargetServers(servers: TargetServer[]): void;
}

// Hub re-emits target servers via apply-setup on every connect, so we don't
// keep them on disk; persisted state would drift from hub.
export class InMemoryServerConfigManager implements ServerConfigManager {
  readTargetServers(): TargetServer[] {
    return [];
  }

  writeTargetServers(): void {}
}

export class FileServerConfigManager implements ServerConfigManager {
  constructor(
    private configPath: string,
    private logger: Logger,
  ) {
    this.logger = logger.child({ component: "ServerConfigManager" });
  }

  readTargetServers(): TargetServer[] {
    try {
      // Check if file exists first
      if (!fs.existsSync(this.configPath)) {
        this.logger.debug(
          "Target servers config file does not exist, using empty config",
          {
            configPath: this.configPath,
          },
        );
        return [];
      }

      // Get file stats to check if it's empty
      const stats = fs.statSync(this.configPath);
      if (stats.size === 0) {
        this.logger.debug(
          "Target servers config file is completely empty (0 bytes), using empty config",
          {
            configPath: this.configPath,
            fileSize: stats.size,
          },
        );
        return [];
      }

      const file = fs.readFileSync(this.configPath, "utf8");

      // Check if file content is empty or only contains whitespace/newlines
      if (!file || file.trim().length === 0) {
        this.logger.debug(
          "Target servers config file is empty or contains only whitespace/newlines, using empty config",
          {
            fileLength: file.length,
            fileContent: `"${file}"`,
            configPath: this.configPath,
          },
        );
        return [];
      }

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
        this.logger.debug(
          "Target servers config file not found, using empty config",
          error,
        );
        return [];
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
    }
  }

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
}
