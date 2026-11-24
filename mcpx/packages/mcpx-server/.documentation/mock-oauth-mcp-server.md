# Mock OAuth + MCP server

A local OAuth authorization server and an OAuth-protected MCP server in one process, with faults you can switch on and off while MCPX is running. Use it to reproduce bugs that need a real OAuth login followed by a misbehaving upstream (rate limits, outages, rejected refreshes), without GitLab, Notion or any other real service.

The same code backs the integration tests (`it/mock-oauth-servers.ts`, `startMockOAuthServers`). `it/manual/run-mock-oauth-server.ts` wraps it in a process with a control API.

## What it does

- Serves the OAuth endpoints and `/.well-known` metadata, supports dynamic client registration, and auto-approves every authorization request, so a login needs no credentials.
- Serves one MCP tool, `whoami`, at `/mcp` over streamable HTTP.
- A request to `/mcp` without a bearer token gets a `401` with OAuth metadata, like a real protected server.
- A fault applies only after the token check, so it models a per-user limit: an unauthenticated probe still sees a `401`, an authenticated call sees the fault.
- Keeps clients and tokens in memory only. See "Restarting the mock".

## Start it

From `mcpx/packages/mcpx-server`:

```bash
npm run it:mock-oauth
npm run it:mock-oauth -- --port 9200 --control-port 9201
npm run it:mock-oauth -- --help
```

| Flag                      | Default | Meaning                                                          |
| ------------------------- | ------- | ---------------------------------------------------------------- |
| `--port <n>`              | 9100    | MCP and OAuth server                                             |
| `--control-port <n>`      | 9101    | control API                                                      |
| `--rotate`                | off     | rotate refresh tokens and revoke the family on reuse             |
| `--token-ttl-seconds <n>` | 3600    | access token lifetime; set it low to exercise refresh and expiry |

It prints the MCP URL and the control URL when ready. Stop it with Ctrl-C. Start it in the background with `&` and stop it with `kill` if you need the terminal.

## Control API

All calls go to the control port.

| Call                                                   | Effect                                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `GET /status`                                          | current fault, authenticated request count, refresh counters, MCP URL                      |
| `POST /fault/mcp?status=<400-599>[&retryAfter=<secs>]` | every authenticated `/mcp` request now answers with that status (and `Retry-After` if set) |
| `DELETE /fault/mcp`                                    | back to normal                                                                             |
| `POST /fault/token[?count=<n>]`                        | the next `n` token requests (default 1) answer `503`, then service resumes                 |

The request count in `/status` counts authenticated requests that reach `/mcp`, faulted ones included. Use it to see how often MCPX calls an upstream while it is failing.

## Reproduce a bug with a real MCPX

This is the flow used for the 429 handling. Adjust the fault to the case you need.

1. Start the mock: `npm run it:mock-oauth`.
2. Start MCPX (`npm run dev:all`) and add the server:
   ```bash
   curl -X POST localhost:9523/target-server -H 'content-type: application/json' \
     -d '{"name":"mock-oauth","type":"streamable-http","url":"http://localhost:9100/mcp"}'
   ```
   The state is `pending-auth`.
3. Log in:
   ```bash
   curl -X POST localhost:9523/auth/initiate/mock-oauth -H 'content-type: application/json' \
     -d '{"callbackUrl":"http://localhost:9523/oauth/callback"}'
   ```
   Open the returned `authorizationUrl` in a browser. The mock approves at once and redirects to MCPX. The state becomes `connected` and the tool `whoami` appears. Without a browser, `curl -D -` the URL, read the `location:` header and `curl` that.
4. Switch on the fault: `curl -X POST "localhost:9101/fault/mcp?status=429&retryAfter=60"`.
5. Make MCPX connect with its stored tokens: **restart MCPX**. Deactivate and activate does not take that path.
6. Look at the result: `curl localhost:9523/system-state` and `curl localhost:9101/status`.
7. Clean up: `curl -X DELETE localhost:9101/fault/mcp`, delete the server in the MCPX UI, stop the mock.

Port 9523 is MCPX's default `MCPX_PORT`. Use yours if it differs.

## Restarting the mock

The mock forgets its registered clients and tokens when it stops. MCPX keeps its copies (in the Hub in enterprise mode, otherwise under `.mcpx/tokens`). After a restart, MCPX presents a client id the mock no longer knows, and login fails with `Invalid client_id`. **Delete the server in MCPX (UI or `DELETE /target-server/<name>`) before restarting the mock, then add it and log in again.**

## Use it in an integration test

```ts
const servers = await startMockOAuthServers({
  rotate: false,
  accessTokenTtlMs: 60_000,
});
await logIn({ harness, serverName });
servers.setMcpFault({ status: 429, retryAfterSeconds: 60 });
```

`it/rate-limit-pending-auth.it.test.ts` is a full example. `setMcpFault`, `clearMcpFault`, `getMcpFault`, `failNextTokenRequest` and `mcpRequests` are on the returned object. Integration tests need no docker for this mock. They run with:

```bash
npx dotenv -e .it.env -- npx jest it/<file> --runInBand --config jest.config.cjs
```

## Adding a new fault

Add it in `it/mock-oauth-servers.ts` next to the existing ones (a field on the returned object plus the behaviour in the request handler), then expose it as a route in `it/manual/run-mock-oauth-server.ts`. Keep it a generic switch (status, delay, count) and not a scenario named after one ticket, so the next bug can reuse it.

## Limits

- Only the MCP endpoint and the token endpoint can be faulted. The authorization and registration endpoints cannot.
- One MCP tool, no prompts or resources.
- The `Retry-After` header is sent, but MCPX's SDK drops it, so it does not change MCPX behaviour today.
- Tokens are not shared across mock restarts (see above).
