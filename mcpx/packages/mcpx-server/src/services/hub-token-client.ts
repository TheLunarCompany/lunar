import {
  deleteOAuthTokensAckSchema,
  loadOAuthTokenAckSchema,
  saveOAuthTokenAckSchema,
  WEBAPP_BOUND_EVENTS,
  wrapInEnvelope,
} from "@mcpx/webapp-protocol/messages";
import {
  OAuthClientInformationFull,
  OAuthClientInformationFullSchema,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import { Logger } from "winston";
import {
  OAuthTokenStoreI,
  StoredTokens,
  storedTokensSchema,
  TokenType,
} from "./oauth-token-store.js";
import { HubSocketAdapter } from "./saved-setups-client.js";

export class HubTokenClient implements OAuthTokenStoreI {
  private readonly logger: Logger;

  constructor(
    private readonly getSocket: () => HubSocketAdapter | null,
    logger: Logger,
  ) {
    this.logger = logger.child({ component: "HubTokenClient" });
  }

  async loadTokens(serverName: string): Promise<StoredTokens | undefined> {
    const raw = await this.load(serverName, "tokens");
    if (raw == null) return undefined;
    const result = storedTokensSchema.safeParse(raw);
    if (!result.success)
      throw new Error(
        `Invalid tokens payload from hub: ${result.error.message}`,
      );
    return result.data;
  }

  async saveTokens(serverName: string, data: StoredTokens): Promise<void> {
    await this.save(serverName, "tokens", data, data.expires_at);
    this.logger.debug("Tokens saved", { serverName });
  }

  async loadCodeVerifier(serverName: string): Promise<string | undefined> {
    const raw = await this.load(serverName, "verifier");
    if (raw == null) return undefined;
    if (typeof raw !== "string")
      throw new Error("Invalid verifier payload from hub: expected string");
    return raw;
  }

  async saveCodeVerifier(serverName: string, verifier: string): Promise<void> {
    await this.save(serverName, "verifier", verifier);
    this.logger.debug("Code verifier saved", { serverName });
  }

  async loadClientInfo(
    serverName: string,
  ): Promise<OAuthClientInformationFull | undefined> {
    const raw = await this.load(serverName, "client");
    if (raw == null) return undefined;
    const result = OAuthClientInformationFullSchema.safeParse(raw);
    if (!result.success)
      throw new Error(
        `Invalid client payload from hub: ${result.error.message}`,
      );
    return result.data;
  }

  async saveClientInfo(
    serverName: string,
    info: OAuthClientInformationFull,
  ): Promise<void> {
    await this.save(serverName, "client", info);
    this.logger.debug("Client info saved", { serverName });
  }

  async deleteAll(serverName: string): Promise<void> {
    const socket = this.requireSocket();
    const envelope = wrapInEnvelope({ payload: { serverName } });
    this.logger.debug("Deleting OAuth tokens", { serverName });
    const raw = await socket.emitWithAck(
      WEBAPP_BOUND_EVENTS.DELETE_OAUTH_TOKENS,
      envelope,
    );
    const parsed = deleteOAuthTokensAckSchema.safeParse(raw);
    if (!parsed.success)
      throw new Error(
        `Failed to delete OAuth tokens for ${serverName}: ${parsed.error.message}`,
      );
    if (!parsed.data.success)
      throw new Error(
        `Failed to delete OAuth tokens for ${serverName}: ${parsed.data.error}`,
      );
    this.logger.debug("Tokens deleted", { serverName });
  }

  private async save(
    serverName: string,
    tokenType: TokenType,
    data: StoredTokens | string | OAuthClientInformationFull,
    expiresAt?: number,
  ): Promise<void> {
    const socket = this.requireSocket();
    const envelope = wrapInEnvelope({
      payload: { serverName, tokenType, data, expiresAt },
    });
    this.logger.debug("Saving OAuth token", { serverName, tokenType });
    const raw = await socket.emitWithAck(
      WEBAPP_BOUND_EVENTS.SAVE_OAUTH_TOKEN,
      envelope,
    );
    const parsed = saveOAuthTokenAckSchema.safeParse(raw);
    if (!parsed.success)
      throw new Error(
        `Failed to save ${tokenType} for ${serverName}: ${parsed.error.message}`,
      );
    if (!parsed.data.success)
      throw new Error(
        `Failed to save ${tokenType} for ${serverName}: ${parsed.data.error}`,
      );
  }

  private async load(
    serverName: string,
    tokenType: TokenType,
  ): Promise<unknown> {
    const socket = this.requireSocket();
    const envelope = wrapInEnvelope({ payload: { serverName, tokenType } });
    this.logger.debug("Loading OAuth token", { serverName, tokenType });
    const raw = await socket.emitWithAck(
      WEBAPP_BOUND_EVENTS.LOAD_OAUTH_TOKEN,
      envelope,
    );
    const parsed = loadOAuthTokenAckSchema.safeParse(raw);
    if (!parsed.success)
      throw new Error(
        `Invalid ack for load ${tokenType}: ${parsed.error.message}`,
      );
    if (!parsed.data.success)
      throw new Error(
        `Hub refused load ${tokenType} for ${serverName}: ${parsed.data.error}`,
      );
    return parsed.data.data ?? undefined;
  }

  private requireSocket(): HubSocketAdapter {
    const socket = this.getSocket();
    if (!socket) throw new Error("Hub not connected");
    return socket;
  }
}
