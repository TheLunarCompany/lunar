# Downstream (Client) Liveness: pings, notification stream, reconnect

## TLDR

MCPX decides a connected client (Claude Desktop, Cursor, Claude Code, etc.) is unresponsive or gone via `SessionLivenessManager`, mirroring the upstream-liveness design (see `upstream-liveness.md`) on the opposite side of the proxy. SSE sessions always get a ping loop (their stream is permanently open). streamableHttp sessions also get one — not gated by any client-version detection or kill-switch — because a server-initiated ping can only reach the client while its standalone GET/notification stream is open; the tick skips (without counting a miss) whenever that stream isn't open, and resumes once it is. AIGW-126: before this, ping support for streamableHttp was gated on a whitelist of `mcp-remote` versions. The pinned version we told users to install (`mcp-remote@0.1.36`) reports itself on the wire as `0.1.35` — confirmed by running the published package — so it, and every other mcp-remote version, failed the gate. With no ping loop, the only liveness signal left was the notification stream's `close` event, which fires on routine stream severs, not just real disconnects, and nothing could clear it. MCPX never closes a streamableHttp session on a guess: a dropped notification stream only flags the session `unresponsive` after a grace period, and missed pings reap a streamable session only if it has answered a ping before.

## Knobs

Defaults live in `src/env.ts`, not here.

| Env var                                  | Meaning                                                                                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `PING_INTERVAL_MS`                       | How often the manager pings a connected session                                                                                  |
| `NOTIFICATION_STREAM_RECONNECT_GRACE_MS` | Time a dropped notification stream may stay down before the session is flagged unresponsive (default 15 s; 0 = flag immediately) |
| `PING_MAX_CONSECUTIVE_TIMEOUTS`          | Consecutive missed pings before a session is reaped                                                                              |
| `AGENT_SESSION_TTL_MIN`                  | Idle TTL backstop for sessions with no deliverable ping channel                                                                  |
| `AGENT_DISCONNECTED_RETENTION_MIN`       | How long a disconnected client still shows on the dashboard                                                                      |

## Flow

```
GET /mcp arrives ──► beginNotificationStream ──► notificationStream = opening(gen)
SDK accepts it (200 + text/event-stream) ──► open(gen)       (pings may now be sent)
SDK rejects it (406/409/throw)            ──► markNotificationStreamClosed
GET stream closes (res "close")           ──► markNotificationStreamClosed({sessionId, generation})
    │ generation stale or already closed  ─► no-op
    │ current                             ─► reconnecting(gen, cancelGrace)   (still shown connected)
    │ new GET or inbound activity         ─► timer cancelled, state none/opening, still connected
    │ grace expires                       ─► unresponsive (session is NOT closed)
ping tick ──► canDeliverPing (stream is open)? ──► no  ──► skip tick, no miss counted, reschedule
                                              │ yes ──► server.request({method:"ping"})
                                                          │ success              ─► recordPingAnswered ─► pingSupport = answered, touchSession, connected
                                                          │ method-not-found/     ─► markPingUnsupported ─► stop pinging, connected
                                                          │ invalid-shape
                                                          │ other error           ─► consecutiveMisses += 1, unresponsive = true
consecutiveMisses reaches threshold ─► closeSession(PingTimeout) only if SSE, or the client has answered a ping before
inbound POST/GET activity, or ping success ─► touchSession ─► connected
```

Key files: `src/services/session-liveness.ts` (`SessionLivenessManager`: ping loop, `canDeliverPing`, `beginNotificationStream`/`markNotificationStreamOpen`/`Closed`, `recordPingAnswered`/`markPingUnsupported`), `src/services/sessions.ts` (`SessionsManager`: exposes `liveness` directly, so callers use `services.sessions.liveness` — no stream pass-throughs; `onLivenessChanged` → `connectionState`), `src/server/downstream-transports.ts` (common normal/restored GET lifecycle, response validation, generation capture), and `src/server/mcp-gateway.ts` (long-running-call keepalives share the learned ping capability).

## Rules worth knowing

1. **A server-initiated ping needs the standalone GET stream.** The MCP SDK routes any request with no `relatedRequestId` — which includes a server's ping — through the session's standalone notification stream; without one open, `send()` silently no-ops. `canDeliverPing` is this fix's version of the upstream side's `"no-signal"`: a tick that can't be delivered must not count as a miss.
2. **A stream's close only matters if it's still the current one.** `notificationStream` is a union: `none` / `opening` / `open` / `reconnecting`. Each GET gets a generation from a manager-wide monotonic counter and moves the session to `opening` — a replacement GET never leaves a stale `open`, so pings are not delivered into a stream the SDK hasn't accepted. Only a successful SSE response moves `opening` to `open`, and a close acts only on the matching `opening`/`open` generation (a duplicate or stale close is a no-op, so it can't restart the timer). A current close enters `reconnecting` and starts the grace timer (default 15 s, covering the SDK's two retries, 1s then 1.5s); the cancel function lives in that state, so a new GET, inbound activity, or session removal always cancels it. When grace expires the session is flagged `unresponsive` — it is never closed. Normal and transparently restored GETs use the same lifecycle. `it/downstream-liveness.it.test.ts` covers reconnection, never-reopened and rejected GETs.
3. **Ping capability is detected at runtime, not from a version string.** There is no whitelist. Every streamableHttp session gets the ping loop ; the first response that is method-not-found or an invalid shape — exactly `upstream-liveness.md`'s `isAlive`/`"no-signal"` logic, reused via `isPingUnsupportedError` — permanently disables the loop for that session (`markPingUnsupported`), same as a genuinely ping-less client. Long-running-call keepalives consult and update this same per-session capability, so they also stop after an unsupported response.
4. **An answer is proof of life, same as upstream.** Any successful ping, or any inbound activity (`touchSession`), resets `consecutiveMisses` to 0 and clears `unresponsive`.
5. **Reaping needs proof the client pings.** A streamable client that never answered a ping may simply hang on it, so it is flagged `unresponsive` but never reaped; one that answered and then went silent is reaped after `PING_MAX_CONSECUTIVE_TIMEOUTS`. Everything else ends via DELETE or the idle TTL (`AGENT_SESSION_TTL_MIN`).

## History, so the numbers make sense

| Change                     | Why                                                                                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| RND-933 (Jul 2026)         | Session foundation: identity, liveness, recovery                                                                                                                                                                                                       |
| AIGW-126 (Oct 2026)        | Removed the `mcp-remote` version whitelist (the pinned `0.1.36` package reports itself as `0.1.35` on the wire, so it never matched); runtime ping detection, stream-open gating on the ping tick, and the generation guard on stream close replace it |
| AIGW-126 review (Oct 2026) | Kill-switch removed; grace expiry flags unresponsive instead of closing; reap gated on a prior answered ping; notification stream modeled as a union                                                                                                   |

## Known debt

- `McpClientAdapter.support` (and its wire-schema counterpart in `hub-downstream-session-client.ts`) is now always unset — nothing produces it since AIGW-126. Left in place to keep that PR scoped to the liveness fix; removing it touches `webapp-protocol` wire schemas too.
- `transport.onerror` (`bindTransportLifecycle` in `src/server/downstream-transports.ts`) still closes the whole session (`TransportError`) on any SDK transport error, including a rejected GET (406/409/400). That is the one remaining path where a single bad request ends a live session; it predates this work and is out of its scope.
