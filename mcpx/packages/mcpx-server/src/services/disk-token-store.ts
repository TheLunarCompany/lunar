import {
  OAuthClientInformationFull,
  OAuthClientInformationFullSchema,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import fs from "fs/promises";
import path from "path";
import { sanitizeFilename } from "@mcpx/toolkit-core/data";
import { Logger } from "winston";
import {
  OAuthTokenStoreI,
  StoredTokens,
  storedTokensSchema,
} from "./oauth-token-store.js";

export class DiskTokenStore implements OAuthTokenStoreI {
  private readonly tokensDir: string;
  private readonly logger: Logger;

  constructor(tokensDir: string, logger: Logger) {
    this.tokensDir = tokensDir;
    this.logger = logger.child({ component: "DiskTokenStore" });
  }

  async loadTokens(serverName: string): Promise<StoredTokens | undefined> {
    const content = await this.readFile(this.tokenPath(serverName));
    if (content === undefined) return undefined;
    const result = storedTokensSchema.safeParse(JSON.parse(content));
    if (!result.success) {
      this.logger.warn("Stored tokens have unexpected shape", {
        serverName,
        error: result.error.message,
      });
      return undefined;
    }
    return result.data;
  }

  async saveTokens(serverName: string, data: StoredTokens): Promise<void> {
    await this.writeFile(
      this.tokenPath(serverName),
      JSON.stringify(data, null, 2),
    );
    this.logger.debug("Tokens saved", { serverName });
  }

  async loadCodeVerifier(serverName: string): Promise<string | undefined> {
    return this.readFile(this.verifierPath(serverName));
  }

  async saveCodeVerifier(serverName: string, verifier: string): Promise<void> {
    await this.writeFile(this.verifierPath(serverName), verifier);
    this.logger.debug("Code verifier saved", { serverName });
  }

  async loadClientInfo(
    serverName: string,
  ): Promise<OAuthClientInformationFull | undefined> {
    const content = await this.readFile(this.clientPath(serverName));
    if (content === undefined) return undefined;
    const result = OAuthClientInformationFullSchema.safeParse(
      JSON.parse(content),
    );
    if (!result.success) {
      this.logger.warn("Stored client info has unexpected shape", {
        serverName,
        error: result.error.message,
      });
      return undefined;
    }
    return result.data;
  }

  async saveClientInfo(
    serverName: string,
    info: OAuthClientInformationFull,
  ): Promise<void> {
    await this.writeFile(
      this.clientPath(serverName),
      JSON.stringify(info, null, 2),
    );
    this.logger.debug("Client info saved", { serverName });
  }

  async deleteAll(serverName: string): Promise<void> {
    await Promise.all(
      [
        this.tokenPath(serverName),
        this.verifierPath(serverName),
        this.clientPath(serverName),
      ].map((p) =>
        fs.rm(p).catch((e: NodeJS.ErrnoException) => {
          if (e.code !== "ENOENT") throw e;
        }),
      ),
    );
    this.logger.debug("Tokens deleted", { serverName });
  }

  private async readFile(p: string): Promise<string | undefined> {
    return fs.readFile(p, "utf8").catch((e: NodeJS.ErrnoException) => {
      if (e.code === "ENOENT") return undefined;
      throw e;
    });
  }

  private async writeFile(p: string, content: string): Promise<void> {
    await fs.mkdir(this.tokensDir, { recursive: true });
    await fs.writeFile(p, content, "utf8");
  }

  private tokenPath(serverName: string): string {
    return path.join(
      this.tokensDir,
      `${sanitizeFilename(serverName)}-tokens.json`,
    );
  }

  private verifierPath(serverName: string): string {
    return path.join(
      this.tokensDir,
      `${sanitizeFilename(serverName)}-verifier.txt`,
    );
  }

  private clientPath(serverName: string): string {
    return path.join(
      this.tokensDir,
      `${sanitizeFilename(serverName)}-client.json`,
    );
  }
}
