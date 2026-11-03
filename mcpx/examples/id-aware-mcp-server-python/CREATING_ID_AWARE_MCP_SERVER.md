# Building Identity-Aware MCP Servers

Your organization runs MCPX as the gateway between AI agents and MCP servers. Sometimes you want a server that knows **who** is calling — to scope data per user, enforce permissions, or log actions. This guide shows you how to write one such server.

## The Big Picture

When a user connects to MCPX through their AI client (Cursor, Claude, etc.), they authenticate via your organization's identity provider. MCPX's auth service verifies the authentication and issues its own signed JWT containing the user's identity claims (`sub`, `email`, `name`, `roles`). On every tool call, MCPX injects that JWT into the request's `_meta` field — a standard MCP protocol field for request metadata, available since the original MCP spec (2024-11-05) and [formalized in 2025-06-18](https://modelcontextprotocol.io/specification/2025-06-18/basic#_meta).

Your server reads the JWT from `_meta`, verifies the signature, and knows exactly who is calling.

```
User authenticates --> MCPX holds the JWT --> Your server receives it on every call
                                              via _meta.authorization
```

That's it. Your server is a regular stdio MCP server. No special transport, no extra infrastructure. Just read `_meta` and verify the token.

## What You Get

After verifying the JWT, you have access to these claims:

| Claim   | What it is                              |
| ------- | --------------------------------------- |
| `sub`   | Unique user ID (stable across sessions) |
| `email` | User's email                            |
| `name`  | Display name                            |
| `roles` | `Member`, `Admin`, or `Owner`           |

MCPX's auth service authenticates users against your organization's identity provider (Okta, Microsoft Entra, Google, etc.), extracts these claims from the original OIDC token, and re-signs them into its own JWT. This normalization means your server always sees the same claim format regardless of which provider is configured. The cryptographic signature guarantees the claims can't be forged or tampered with.

## Quick Start

### 1. Read the JWT from `_meta`

Every tool call carries `_meta.authorization` with the value `Bearer <jwt>`. How you access it depends on your SDK:

**Python (FastMCP):**

```python
@mcp.tool()
async def my_tool(ctx: Context) -> str:
    meta = ctx.request_context.meta
    authorization = getattr(meta, "authorization", None)
```

**TypeScript (MCP SDK):**

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const authorization = request.params._meta?.authorization;
});
```

### 2. Verify and extract claims

Use any JWT library. Three environment variables tell your server how to verify:

| Variable       | What it is              |
| -------------- | ----------------------- |
| `JWKS_URI`     | Public key endpoint     |
| `JWT_ISSUER`   | Expected token issuer   |
| `JWT_AUDIENCE` | Expected token audience |

These are **automatically provided** by the platform — your server just reads them from its environment.

```python
import jwt
from jwt import PyJWKClient

jwks_client = PyJWKClient(os.environ["JWKS_URI"])

def get_identity(token: str) -> dict:
    signing_key = jwks_client.get_signing_key_from_jwt(token)
    claims = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        issuer=os.environ["JWT_ISSUER"],
        audience=os.environ["JWT_AUDIENCE"],
    )
    return {
        "sub": claims["sub"],
        "email": claims.get("email"),
        "name": claims.get("name"),
        "roles": claims.get("roles", []),
    }
```

### 3. Do whatever you want with it

- Scope database queries to `sub`
- Check `roles` before sensitive operations
- Log who did what
- Return personalized results
- Route to tenant-specific resources

### 4. Package and ship

Your server runs as **stdio** — reading JSON-RPC from stdin, writing to stdout. Package it however you like:

| Method | Example                   |
| ------ | ------------------------- |
| PyPI   | `uvx my-server`           |
| npm    | `npx my-server`           |
| Docker | `docker run -i my-server` |

## Adding to MCPX

In the admin UI, go to **Hosted MCP Servers** and create a new server. Paste your server config — it's a standard MCP server definition. An identity-aware server is configured exactly like any other hosted server.

**uvx:**
```json
{
  "my-id-aware-server": {
    "type": "stdio",
    "command": "uvx",
    "args": ["my-id-aware-server"]
  }
}
```

**npx:**
```json
{
  "my-id-aware-server": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "my-id-aware-server"]
  }
}
```

**Docker:**
```json
{
  "my-id-aware-server": {
    "type": "stdio",
    "command": "docker",
    "args": [
      "run",
      "-i",
      "--rm",
      "--pull=always",
      "-e", "JWKS_URI",
      "-e", "JWT_ISSUER",
      "-e", "JWT_AUDIENCE",
      "<handle>/<name>:<tag>"
    ]
  }
}
```

For uvx/npx, the platform injects the JWT verification env vars automatically. For Docker, the `-e` flags forward them into the container.

Once the hosted server is running, you can **publish it to the Organizational Catalog** — it then becomes available to all users in your org, just like any other catalog item.

### Private registries

MCPX needs to be able to pull your server artifact from wherever it's hosted. Private registries are supported via the helm chart's `mcpxRuntimeAuth` configuration:

- **Docker**: `dockerConfigSecret` — Kubernetes secret with Docker registry credentials
- **npm**: `npmrcSecret` — secret with `.npmrc` for private npm registries
- **PyPI**: `uvConfigSecret` — secret with `uv.toml` for private PyPI indexes

### Building a Docker image

Build for amd64 (the platform MCPX runs on) and push:

```bash
docker buildx build --platform linux/amd64 -t <handle>/<name>:<tag> --push .
```

## Full Example

See [server.py](./server.py) for a complete Python implementation — a `whoami` tool that verifies the JWT and returns the caller's identity.
