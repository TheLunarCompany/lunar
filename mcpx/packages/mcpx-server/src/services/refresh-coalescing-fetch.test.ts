import { describe, expect, it } from "@jest/globals";
import { noOpLogger } from "@mcpx/toolkit-core/logging";
import { ManualClock } from "@mcpx/toolkit-core/time";
import { refreshAuthorization } from "@modelcontextprotocol/sdk/client/auth.js";
import { FetchLike } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  REPLAY_WINDOW_MS,
  RefreshCoalescer,
} from "./refresh-coalescing-fetch.js";

const TOKEN_URL = "https://idp.example/token";
const CONCURRENT_CALLERS = 5;
const DEFAULT_EXPIRES_IN_S = 3600;
const SHORT_EXPIRES_IN_S = 2;

interface Latch {
  promise: Promise<void>;
  open: () => void;
}

function latch(): Latch {
  const holder = { open: (): void => {} };
  const promise = new Promise<void>((resolve) => {
    holder.open = resolve;
  });
  return { promise, open: () => holder.open() };
}

// What the IdP saw for one request: the refresh token it carried, or "passthrough".
function describeRequest(init: RequestInit | undefined): string {
  const body = init?.body;
  if (!(body instanceof URLSearchParams)) return "passthrough";
  if (body.get("grant_type") !== "refresh_token") return "passthrough";
  return body.get("refresh_token") ?? "passthrough";
}

interface TokenEndpoint {
  fetch: FetchLike;
  received: string[];
  release: () => void;
}

// Fake token endpoint. Every request that reaches it is recorded and issues
// "at-<n>" plus refresh token "rotated-<n>". A held endpoint waits for release().
function tokenEndpoint(
  props: {
    held?: boolean;
    failWith?: Error;
    expiresIn?: number;
    statuses?: number[];
  } = {},
): TokenEndpoint {
  const received: string[] = [];
  const gate = latch();
  if (!props.held) gate.open();
  const fetchFn: FetchLike = async (_url, init) => {
    const n = received.push(describeRequest(init));
    await gate.promise;
    if (props.failWith) throw props.failWith;
    const status = props.statuses?.[n - 1] ?? 200;
    if (status !== 200) return new Response("{}", { status });
    return new Response(
      JSON.stringify({
        access_token: `at-${n}`,
        refresh_token: `rotated-${n}`,
        token_type: "bearer",
        expires_in: props.expiresIn ?? DEFAULT_EXPIRES_IN_S,
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  return { fetch: fetchFn, received, release: gate.open };
}

function refreshRequest(refreshToken: string): RequestInit {
  return {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  };
}

async function accessTokenOf(response: Response): Promise<string> {
  const body: unknown = await response.json();
  if (
    typeof body === "object" &&
    body !== null &&
    "access_token" in body &&
    typeof body.access_token === "string"
  ) {
    return body.access_token;
  }
  throw new Error(`No access_token in ${JSON.stringify(body)}`);
}

function nextTick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function buildWrapped(endpoint: TokenEndpoint, clock = new ManualClock()) {
  return new RefreshCoalescer("srv", noOpLogger, clock).wrap(endpoint.fetch);
}

describe("RefreshCoalescer", () => {
  it("passes requests that are not refresh grants straight through", async () => {
    const endpoint = tokenEndpoint();
    const wrapped = buildWrapped(endpoint);

    await wrapped(TOKEN_URL, {
      method: "POST",
      body: new URLSearchParams({ grant_type: "authorization_code" }),
    });
    await wrapped(TOKEN_URL, {
      method: "POST",
      body: new URLSearchParams({ grant_type: "authorization_code" }),
    });
    await wrapped("https://mcp.example/mcp", { method: "GET" });

    expect(endpoint.received).toEqual([
      "passthrough",
      "passthrough",
      "passthrough",
    ]);
  });

  it("sends one refresh for concurrent callers and hands each the same tokens", async () => {
    const endpoint = tokenEndpoint({ held: true });
    const wrapped = buildWrapped(endpoint);

    const calls = Array.from({ length: CONCURRENT_CALLERS }, () =>
      wrapped(TOKEN_URL, refreshRequest("rt-1")).then(accessTokenOf),
    );
    await nextTick();
    expect(endpoint.received).toEqual(["rt-1"]);

    endpoint.release();
    expect(await Promise.all(calls)).toEqual(
      Array(CONCURRENT_CALLERS).fill("at-1"),
    );
    expect(endpoint.received).toEqual(["rt-1"]);
  });

  it("lets a caller that arrives while the refresh is in flight join it", async () => {
    const endpoint = tokenEndpoint({ held: true });
    const wrapped = buildWrapped(endpoint);

    const first = wrapped(TOKEN_URL, refreshRequest("rt-1")).then(
      accessTokenOf,
    );
    await nextTick();
    const joiner = wrapped(TOKEN_URL, refreshRequest("rt-1")).then(
      accessTokenOf,
    );
    endpoint.release();

    expect(await Promise.all([first, joiner])).toEqual(["at-1", "at-1"]);
    expect(endpoint.received).toEqual(["rt-1"]);
  });

  it("replays a just-finished refresh to a late caller still holding that token", async () => {
    const endpoint = tokenEndpoint();
    const wrapped = buildWrapped(endpoint);

    const first = await wrapped(TOKEN_URL, refreshRequest("rt-1"));
    const late = await wrapped(TOKEN_URL, refreshRequest("rt-1"));

    expect(await accessTokenOf(first)).toBe("at-1");
    expect(await accessTokenOf(late)).toBe("at-1");
    expect(endpoint.received).toEqual(["rt-1"]);
  });

  it("still replays just inside the replay window", async () => {
    const endpoint = tokenEndpoint();
    const clock = new ManualClock();
    const wrapped = buildWrapped(endpoint, clock);

    await wrapped(TOKEN_URL, refreshRequest("rt-1"));
    clock.advanceBy(REPLAY_WINDOW_MS - 1);
    const late = await wrapped(TOKEN_URL, refreshRequest("rt-1"));

    expect(await accessTokenOf(late)).toBe("at-1");
    expect(endpoint.received).toEqual(["rt-1"]);
  });

  it("refreshes again after the replay window, for IdPs that never rotate the refresh token", async () => {
    const endpoint = tokenEndpoint();
    const clock = new ManualClock();
    const wrapped = buildWrapped(endpoint, clock);

    await wrapped(TOKEN_URL, refreshRequest("rt-1"));
    clock.advanceBy(REPLAY_WINDOW_MS);
    const nextExpiry = await wrapped(TOKEN_URL, refreshRequest("rt-1"));

    expect(await accessTokenOf(nextExpiry)).toBe("at-2");
    expect(endpoint.received).toEqual(["rt-1", "rt-1"]);
  });

  it("stops replaying once the replayed access token expires, even inside the window", async () => {
    const endpoint = tokenEndpoint({ expiresIn: SHORT_EXPIRES_IN_S });
    const clock = new ManualClock();
    const wrapped = buildWrapped(endpoint, clock);

    await wrapped(TOKEN_URL, refreshRequest("rt-1"));
    clock.advanceBy(SHORT_EXPIRES_IN_S * 1000 - 1);
    const beforeExpiry = await wrapped(TOKEN_URL, refreshRequest("rotated-1"));
    clock.advanceBy(1);
    const atExpiry = await wrapped(TOKEN_URL, refreshRequest("rotated-1"));

    expect(await accessTokenOf(beforeExpiry)).toBe("at-1");
    expect(await accessTokenOf(atExpiry)).toBe("at-2");
    expect(endpoint.received).toEqual(["rt-1", "rotated-1"]);
  });

  it("replays to a caller that already holds the refresh token the last refresh issued", async () => {
    const endpoint = tokenEndpoint();
    const wrapped = buildWrapped(endpoint);

    await wrapped(TOKEN_URL, refreshRequest("rt-1"));
    const late = await wrapped(TOKEN_URL, refreshRequest("rotated-1"));

    expect(await accessTokenOf(late)).toBe("at-1");
    expect(endpoint.received).toEqual(["rt-1"]);
  });

  it("refreshes the issued token for real once the replay window has passed", async () => {
    const endpoint = tokenEndpoint();
    const clock = new ManualClock();
    const wrapped = buildWrapped(endpoint, clock);

    await wrapped(TOKEN_URL, refreshRequest("rt-1"));
    clock.advanceBy(REPLAY_WINDOW_MS);
    const nextExpiry = await wrapped(TOKEN_URL, refreshRequest("rotated-1"));

    expect(await accessTokenOf(nextExpiry)).toBe("at-2");
    expect(endpoint.received).toEqual(["rt-1", "rotated-1"]);
  });

  it("sends a refresh for an unrelated token right away", async () => {
    const endpoint = tokenEndpoint();
    const wrapped = buildWrapped(endpoint);

    await wrapped(TOKEN_URL, refreshRequest("rt-1"));
    const rotated = await wrapped(TOKEN_URL, refreshRequest("rt-2"));

    expect(await accessTokenOf(rotated)).toBe("at-2");
    expect(endpoint.received).toEqual(["rt-1", "rt-2"]);
  });

  it("does not replay a failed refresh, so the next call tries again", async () => {
    const endpoint = tokenEndpoint({ statuses: [503, 200] });
    const wrapped = buildWrapped(endpoint);

    const failed = await wrapped(TOKEN_URL, refreshRequest("rt-1"));
    const retried = await wrapped(TOKEN_URL, refreshRequest("rt-1"));

    expect(failed.status).toBe(503);
    expect(await accessTokenOf(retried)).toBe("at-2");
    expect(endpoint.received).toEqual(["rt-1", "rt-1"]);
  });

  it("fails every waiting caller on a transport error, then sends again on the next call", async () => {
    const failure = new Error("connection reset");
    const endpoint = tokenEndpoint({ held: true, failWith: failure });
    const wrapped = buildWrapped(endpoint);

    const calls = Array.from({ length: CONCURRENT_CALLERS }, () =>
      wrapped(TOKEN_URL, refreshRequest("rt-1")).then(
        () => "resolved",
        (error: unknown) => error,
      ),
    );
    await nextTick();
    endpoint.release();

    expect(await Promise.all(calls)).toEqual(
      Array(CONCURRENT_CALLERS).fill(failure),
    );
    expect(endpoint.received).toEqual(["rt-1"]);

    await wrapped(TOKEN_URL, refreshRequest("rt-1")).catch(() => undefined);
    expect(endpoint.received).toEqual(["rt-1", "rt-1"]);
  });

  it("coalesces the refreshes the real SDK sends", async () => {
    const endpoint = tokenEndpoint({ held: true });
    const wrapped = buildWrapped(endpoint);

    const refreshes = Array.from({ length: CONCURRENT_CALLERS }, () =>
      refreshAuthorization("https://idp.example", {
        clientInformation: { client_id: "mcpx" },
        refreshToken: "rt-1",
        fetchFn: wrapped,
      }),
    );
    await nextTick();
    endpoint.release();

    const tokens = await Promise.all(refreshes);
    expect(tokens.map((t) => t.access_token)).toEqual(
      Array(CONCURRENT_CALLERS).fill("at-1"),
    );
    expect(tokens.map((t) => t.refresh_token)).toEqual(
      Array(CONCURRENT_CALLERS).fill("rotated-1"),
    );
    expect(endpoint.received).toEqual(["rt-1"]);
  });
});
