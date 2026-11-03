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

// The token store holds OAuth access tokens, refresh tokens, PKCE code
// verifiers and client credentials. They must not be readable by other local
// users, so the directory and its files are restricted to the owner.
const TOKENS_DIR_MODE = 0o700;
const TOKEN_FILE_MODE = 0o600;

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
    await fs.mkdir(this.tokensDir, { recursive: true, mode: TOKENS_DIR_MODE });
    // `mode` on `mkdir` only applies to directories it creates, and is masked
    // by the process umask, so tighten explicitly to also cover a directory
    // left behind by an earlier version.
    await fs.chmod(this.tokensDir, TOKENS_DIR_MODE);

    // Open (and truncate) before writing so the permissions can be tightened
    // while the file is still empty. This also repairs files created by an
    // earlier version, and is unaffected by the umask.
    const handle = await fs.open(p, "w", TOKEN_FILE_MODE);
    try {
      await handle.chmod(TOKEN_FILE_MODE);
      await handle.writeFile(content, "utf8");
    } finally {
      await handle.close();
    }
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
