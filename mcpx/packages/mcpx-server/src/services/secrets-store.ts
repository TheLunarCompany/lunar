import { Logger } from "winston";

export class SecretsStore {
  private secretKeys: string[] | null = null;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child({ component: "SecretsStore" });
  }

  setSecretKeys(keys: string[]): void {
    this.secretKeys = keys;
    this.logger.info("Secret keys updated", { count: keys.length });
  }

  getSecretKeys(): string[] {
    if (this.secretKeys === null) {
      return [];
    }
    const envKeys = new Set(Object.keys(process.env));
    const available: string[] = [];
    for (const key of this.secretKeys) {
      if (envKeys.has(key)) {
        available.push(key);
      } else {
        this.logger.warn("Secret key from Hub not found in process.env", {
          key,
        });
      }
    }
    return available;
  }
}
