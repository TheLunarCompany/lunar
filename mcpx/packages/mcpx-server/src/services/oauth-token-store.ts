import {
  OAuthClientInformationFull,
  OAuthTokens,
  OAuthTokensSchema,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import z from "zod/v4";

export type StoredTokens = OAuthTokens & { expires_at?: number };

export interface OAuthTokenStoreI {
  loadTokens(serverName: string): Promise<StoredTokens | undefined>;
  saveTokens(serverName: string, data: StoredTokens): Promise<void>;
  loadCodeVerifier(serverName: string): Promise<string | undefined>;
  saveCodeVerifier(serverName: string, verifier: string): Promise<void>;
  loadClientInfo(
    serverName: string,
  ): Promise<OAuthClientInformationFull | undefined>;
  saveClientInfo(
    serverName: string,
    info: OAuthClientInformationFull,
  ): Promise<void>;
  deleteAll(serverName: string): Promise<void>;
}

export type TokenType = "tokens" | "verifier" | "client";

export const storedTokensSchema = OAuthTokensSchema.extend({
  expires_at: z.number().optional(),
});
