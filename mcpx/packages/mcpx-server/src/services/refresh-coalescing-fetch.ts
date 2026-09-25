import { OAuthTokensSchema } from "@modelcontextprotocol/sdk/shared/auth.js";
import { FetchLike } from "@modelcontextprotocol/sdk/shared/transport.js";
import { Clock, systemClock } from "@mcpx/toolkit-core/time";
import { Logger } from "winston";

// RFC 6749 section 6, refresh token request.
const RFC_6749 = {
  PARAMS: { GRANT_TYPE: "grant_type", REFRESH_TOKEN: "refresh_token" },
  GRANT_TYPES: { REFRESH_TOKEN: "refresh_token" },
};

// Upper bound on replaying a refresh; outlasts a late caller by far. Also capped by the access token's lifetime.
export const REPLAY_WINDOW_MS = 30_000;

function refreshTokenOf(init: RequestInit | undefined): string | undefined {
  const body = init?.body;
  if (!(body instanceof URLSearchParams)) return undefined;
  if (
    body.get(RFC_6749.PARAMS.GRANT_TYPE) !== RFC_6749.GRANT_TYPES.REFRESH_TOKEN
  )
    return undefined;
  return body.get(RFC_6749.PARAMS.REFRESH_TOKEN) ?? undefined;
}

interface ReplayTerms {
  issuedRefreshToken: string | undefined;
  replayMs: number;
}

interface CompletedRefresh {
  // The refresh token MCPX sent.
  refreshToken: string;
  // The refresh token the IdP returned in its place; undefined when it does not rotate.
  issuedRefreshToken: string | undefined;
  // The IdP's answer, only ever cloned.
  response: Response;
  // Epoch ms after which this answer is no longer handed out.
  replayUntil: number;
}

// What a refresh rotated to, and how long it may be replayed: never past the access token it issued.
async function replayTermsOf(response: Response): Promise<ReplayTerms> {
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => undefined);
  const tokens = OAuthTokensSchema.safeParse(body).data;
  const expiresInMs =
    tokens?.expires_in === undefined
      ? REPLAY_WINDOW_MS
      : tokens.expires_in * 1000;
  return {
    issuedRefreshToken: tokens?.refresh_token,
    replayMs: Math.min(REPLAY_WINDOW_MS, expiresInMs),
  };
}

// SDK auth() refreshes once per 401 and rotating IdPs revoke on reuse, so share one refresh per server.
export class RefreshCoalescer {
  // Stored responses are never read, only cloned, so their body stays readable for every caller.
  private inFlight: Promise<Response> | undefined;
  private last: CompletedRefresh | undefined;

  constructor(
    private readonly serverName: string,
    private readonly logger: Logger,
    private readonly clock: Clock = systemClock,
  ) {}

  wrap(fetchFn: FetchLike = fetch): FetchLike {
    return (url, init) => {
      const refreshToken = refreshTokenOf(init);
      // Not a refresh grant: nothing to coalesce, just call through.
      if (!refreshToken) return fetchFn(url, init);
      return this.coalesce(refreshToken, () => fetchFn(url, init));
    };
  }

  private async coalesce(
    refreshToken: string,
    send: () => Promise<Response>,
  ): Promise<Response> {
    const { last } = this;
    if (
      last &&
      (last.refreshToken === refreshToken ||
        last.issuedRefreshToken === refreshToken) &&
      this.clock.now().getTime() < last.replayUntil
    ) {
      this.logger.info("Reusing recent token refresh", {
        serverName: this.serverName,
      });
      // This token was just refreshed or just issued: return that same answer, don't refresh again.
      // Happens when a request read tokens right around the moment the refreshed ones were saved.
      return last.response.clone();
    }
    if (this.inFlight) {
      this.logger.info("Joining in-flight token refresh", {
        serverName: this.serverName,
      });
      // A refresh is already out: share its response instead of posting a second one.
      return (await this.inFlight).clone();
    }
    // First caller: the one real refresh goes out here, everyone else joins or replays it.
    this.inFlight = send();
    try {
      const response = await this.inFlight;
      // Only successes are replayed: a failed refresh (e.g. a 503) gets a fresh try on the next call.
      if (response.ok) {
        const { issuedRefreshToken, replayMs } = await replayTermsOf(response);
        // Only the sender reaches here, once per real refresh; the next expiry's refresh replaces it.
        this.last = {
          refreshToken,
          issuedRefreshToken,
          response,
          replayUntil: this.clock.now().getTime() + replayMs,
        };
      }
      return response.clone();
    } finally {
      this.inFlight = undefined;
    }
  }
}
