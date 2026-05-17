import { Logger } from "winston";

export interface EnvVarResolver {
  resolve(name: string): string | undefined;
}

/**
 * Holds env var name→value entries pushed from hub. Falls back to process.env
 * when a name is not present in the snapshot. Used to resolve env-var
 * references in incoming config without
 * requiring those vars to be set in mcpx's own pod environment.
 */
export class EnvVarManager implements EnvVarResolver {
  private map: Map<string, string> = new Map();
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ component: "EnvVarManager" });
  }

  setSnapshot(entries: Record<string, string>): void {
    this.map = new Map(Object.entries(entries));
    this.logger.info("Env vars snapshot received", {
      count: this.map.size,
      names: Array.from(this.map.keys()),
    });
  }

  resolve(name: string): string | undefined {
    return this.map.get(name) ?? process.env[name];
  }
}
