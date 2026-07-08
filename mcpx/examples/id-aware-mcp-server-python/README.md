# Identity-Aware MCP Server (Python) — POC

A streamable-HTTP MCP server that verifies JWT identity tokens and exposes user claims via tools.

> **Want to build your own?** This README explains how to run this example server. For a guide on writing your own identity-aware MCP server in the mcpx ecosystem — covering the concepts, the auth flow, and what your server needs to do — see [CREATING_ID_AWARE_MCP_SERVER.md](CREATING_ID_AWARE_MCP_SERVER.md).

This is a proof-of-concept for the case where the MCP server the customer develops needs to know **who the user is** — using the same identity token issued by the OIDC provider configured for mcpx login. The JWT that the user obtained when authenticating with mcpx is forwarded to this server, which verifies it against the same issuer's JWKS endpoint.

Use this as a template for building your own identity-aware MCP servers — replace the `whoami` tool with your own tools that need to know who the caller is.

This is **not** the pattern for MCP servers that need tokens from a third-party service (e.g. GitHub, Jira). Those require the MCP server to implement its own OAuth flow independently.

## How it works

1. The client sends a JWT in the `authorization` header (mcpx will allow this)
2. The server extracts the Bearer token from the header on each tool call
3. Verifies the JWT signature against the OIDC provider's JWKS endpoint
4. Exposes the verified claims (email, name, sub) through the `whoami` tool
5. Rejects missing, expired, or fabricated tokens with an error

## Setup

```bash
pip install -e .
cp .env.example .env  # then fill in your OIDC provider details
```

## Configuration

| Variable       | Description          | Example                                             |
| -------------- | -------------------- | --------------------------------------------------- |
| `JWKS_URI`     | JWKS endpoint URL    | `https://your-org.okta.com/oauth2/default/v1/keys`  |
| `JWT_ISSUER`   | Expected `iss` claim | `https://your-org.okta.com/oauth2/default`           |
| `JWT_AUDIENCE` | Expected `aud` claim | `your-client-id`                                    |
| `PORT`         | Server port          | `4050` (default)                                    |

## Run

```bash
python server.py
```

## Running as non-root

The provided `Dockerfile` creates an unprivileged `appuser` (uid 10001) and switches to it before the entrypoint. When you adapt this example to your own MCP server, keep that pattern — most container runtimes (Kubernetes with `runAsNonRoot: true`, gVisor, restricted Pod Security profiles) refuse to start root containers, and a compromised MCP server running as root has the blast radius of the whole container.

If your server needs to bind to a privileged port (<1024), prefer binding to a high port and exposing it via a Service / Ingress port mapping rather than running as root.

## Testing

Use [MCP Inspector](https://github.com/modelcontextprotocol/inspector) to connect to `http://localhost:4050/mcp` and add a custom `authorization` header with a `Bearer <jwt>` value.

## Tools

### `whoami`

Returns the authenticated user's identity from the JWT token.

**Success:**

```json
{ "sub": "user-123", "email": "user@example.com", "name": "Jane Doe" }
```

**No token / invalid token:** tool call fails with an error describing the reason.
