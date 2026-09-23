# Upstream Liveness: pings, tool calls, reconnect

## TLDR

MCPX decides an upstream MCP server is gone with one consecutive-failure counter per server, owned by `UpstreamWatchdog`. Two sources feed it: the periodic ping and the outcome of every tool call. Only when the counter reaches `UPSTREAM_PING_FAILURE_THRESHOLD` does MCPX close the client, mark the server `connection-failed` and schedule a reconnect. Before GAT-165 a single tool-call transport error skipped the counter and tore the server down on the spot, which took a healthy upstream offline for 30s after one dropped socket.

## Knobs

Defaults live in `src/env.ts`, not here.

| Env var                            | Meaning                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------- |
| `UPSTREAM_PING_INTERVAL_MS`        | How often the watchdog pings a connected server                           |
| `UPSTREAM_PING_TIMEOUT_MS`         | How long a ping may take before it counts as a failure                    |
| `UPSTREAM_PING_FAILURE_THRESHOLD`  | Consecutive failures (pings and tool calls together) before teardown      |
| `UPSTREAM_RECONNECT_BASE_DELAY_MS` | First reconnect delay; doubles per attempt up to `MAX_RECONNECT_DELAY_MS` |

Worst case to detect a silently dead server with no traffic: threshold x (interval + timeout). Under traffic, failed tool calls get there faster.

## Flow

```
ping tick ──► pingServer ──► PingOutcome
                              │ null        (alive)        ─► counter = 0
                              │ Error       (unreachable)  ─► counter + 1
                              │ "no-signal" (nothing checked) skipped
tool call ─► executeWithAuthRetry
                              │ result, or any McpError    ─► counter = 0
                              │ transport error (not 401)  ─► counter + 1
counter reaches threshold ─► unwatch ─► onServerUnreachable
                              ─► close client, state connection-failed
                              ─► enqueueReconnect (base delay, then backoff)
reconnect succeeds ─► watch again, counter = 0
```

Key files: `src/services/upstream-watchdog.ts` (counter, ping loop, `reportSuccess` / `reportFailure`), `src/services/upstream-handler.ts` (`executeWithAuthRetry`, `onServerUnreachable`, `enqueueReconnect`, `shutdown`), `src/services/client-extension.ts` (`isAlive`, `PingOutcome`, `isTransportError`).

## Rules worth knowing

1. **An answer is proof of life.** A JSON-RPC error (`McpError`) means the server received and processed the request, so it resets the counter. Only transport-level failures count against a server. 401s are excluded from both and go through the OAuth recovery path instead.
2. **`null` is not the only non-failure ping result.** `isAlive` returns `"no-signal"` when the server answered ping with `-32601` (method not found) or when no client is connected. The watchdog must skip it. Treating it as success wiped the tool-call failures on every ping tick and kept a dead ping-less server `connected` forever. `it/upstream-liveness.it.test.ts` covers this.
3. **Servers without ping support are still watched.** They are registered with a no-op ping stopper so reported tool calls keep counting. This is what PR #2887 wanted: such servers must still reconnect.
4. **`isTransportError` is broad on purpose.** Any `Error` that is not an `McpError`, so aborts and Zod failures count too. Harmless now that it only ticks a counter.
5. **Shutdown sets a flag.** `shutdown` clears the queued reconnect timers, but a reconnect already in flight would re-enqueue itself afterwards. `enqueueReconnect` is a no-op once `shuttingDown` is set. Symptom when this regresses: an IT passes, then "Jest did not exit".

## History, so the numbers make sense

| Change                    | Why                                                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| #2874 (Apr 2026)          | Reconnect backoff, 1s base                                                                                                                       |
| #2887 (May 2026)          | `isAlive` returns no signal once a server says `-32601`; tool-call transport errors tear down directly so ping-less servers still reconnect      |
| #3058 (Jun 2026)          | Base delay 1s to 30s, cap 1h: each reconnect of an OAuth upstream opened a browser tab. Flow dedupe was the real fix, the delay is a second belt |
| #3400, GAT-148 (Sep 2026) | Ping timeout 3s to 10s, 3-miss threshold on the ping path. Under load the ping answer queued behind 5MB tool results                             |
| #3423, GAT-165 (Sep 2026) | Tool-call outcomes feed the same counter; `PingOutcome`; shutdown flag                                                                           |

## Known debt

- The base delay serves the OAuth path but is also the first delay after a real teardown, so a recovered server waits a full base delay before the first retry. A reason-aware schedule (immediate first attempt for transport teardown, slow for pending auth) is the follow-up. Talk to Eitan before touching it.
- Under jest, undici's `TypeError: fetch failed` is created in another realm and fails `instanceof Error`, so `makeError` yields "Unknown error" and `isTransportError` returns false. ITs take an upstream down with a 503 instead of closing the socket. Making error detection realm-safe is its own ticket.
- The tool-call cache (`ENABLE_TOOL_CALL_CACHE`, on in the IT mock hub) answers identical calls without touching the upstream. ITs that need the upstream hit must vary the arguments.
