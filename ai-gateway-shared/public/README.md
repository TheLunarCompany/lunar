# ai-gateway-shared (public)

Product-agnostic building blocks shared by the AI Gateway products. Anything MCP, MCPX or LLM specific stays in its product package.

## `@aigw/core`

time, concurrency, config, app lifecycle, http, ip-access, data helpers + AES-GCM crypto, logger (incl. Loki telemetry), test helpers.

This root has its own `package.json` and `package-lock.json`. Consumers use `file:` dependencies.

## Rules

- `@aigw/core` never imports MCPX packages (the `@mcpx` scope).
- Consumers import `@aigw/core` directly, with no re-export shims in product packages.
- Product layers stay out: MCPX `toolkit-core` keeps `oauth` and `normalizeServerName`.

## Working here

- Build: `cd packages/core && npm run build`.
- Logger telemetry labels are a plain `Record<string, string>`; the caller decides the keys.
