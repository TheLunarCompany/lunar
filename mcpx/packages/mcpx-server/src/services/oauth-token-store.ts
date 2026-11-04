import {
  OAuthClientInformationFull,
  OAuthTokens,
  OAuthTokensSchema,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import z from "zod/v4";

export type StoredTokens = OAuthTokens & { expires_at?: number };

// The store could not be reached, so it gave no answer (e.g. the Hub socket is
// away). Callers may try again. Any other error is an answer from the store.
export class TokenStoreUnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TokenStoreUnavailableError";
  }
}

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
