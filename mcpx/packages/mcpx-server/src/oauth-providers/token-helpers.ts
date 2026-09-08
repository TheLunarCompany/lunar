import { OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
import { Clock, systemClock } from "@mcpx/toolkit-core/time";
import { Logger } from "winston";
import { StoredTokens } from "../services/oauth-token-store.js";

export function withExpiresAt(
  tokens: OAuthTokens,
  clock: Clock = systemClock,
): StoredTokens {
  return {
    ...tokens,
    ...(tokens.expires_in !== undefined
      ? { expires_at: clock.now().getTime() + tokens.expires_in * 1000 }
      : {}),
  };
}

// Returns the stored tokens unless the access token is expired AND no refresh
// token is available. When a refresh token is present, expired tokens are
// returned as-is so the MCP SDK can refresh on the next 401 instead of forcing
// a full re-authentication flow.
export function applyExpiryPolicy({
  stored,
  serverName,
  clock = systemClock,
  logger,
}: {
  stored: StoredTokens;
  serverName: string;
  clock?: Clock;
  logger: Logger;
}): StoredTokens | undefined {
  if (
    stored.expires_at === undefined ||
    clock.now().getTime() <= stored.expires_at
  ) {
    return stored;
  }
  if (!stored.refresh_token) {
    logger.info("Tokens expired, no refresh token available", { serverName });
    return undefined;
  }
  logger.info("Access token expired, refresh token available", { serverName });
  return stored;
}
