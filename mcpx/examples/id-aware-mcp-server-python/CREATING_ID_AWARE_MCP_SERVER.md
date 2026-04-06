# Writing Your Own Identity-Aware MCP Server

This guide walks you through building an MCP server that knows **who the user is** in the mcpx ecosystem. It's based on the example in this directory — a Python server using FastMCP — but the concepts apply to any language or framework.

> The example uses [FastMCP](https://github.com/jlowin/fastmcp) to keep things simple. You can use any MCP SDK you like — what matters are the patterns below.

## What "identity-aware" means

Sometimes your tools need to act on behalf of a specific user — but you can't just trust a request that says "hi, I'm Bob". You need a way to **cryptographically verify** who's calling, so your server can confidently act on their behalf.

The approach: mcpx forwards the **same JWT** the user used to authenticate with mcpx itself, in the HTTP `Authorization` header. Your server verifies it against the OIDC provider's public keys and extracts the user's proven identity.

## Quick primer

| Concept              | What it is                                                                                                                                                                                                                                                           |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **JWT**              | A signed token carrying _claims_ — key-value pairs like `"email": "alice@example.com"`. Cryptographically signed, so you can verify it wasn't tampered with.                                                                                                         |
| **OIDC provider**    | The service that authenticates users and issues JWTs (e.g. Okta, Auth0). When a user logs in through mcpx, the OIDC provider issues the token.                                                                                                                       |
| **JWKS**             | A public endpoint the OIDC provider publishes with the keys used to sign tokens. Your server fetches these to verify signatures — no secrets needed. Keys are typically cached locally, so after the first fetch, verification happens entirely within your service. |
| **Issuer (`iss`)**   | JWT claim identifying who issued the token. Your server checks it matches the provider you trust.                                                                                                                                                                    |
| **Audience (`aud`)** | JWT claim saying who the token is _for_. Prevents tokens meant for other services from being reused against yours.                                                                                                                                                   |
| **Claims**           | The JWT payload: `sub` (unique user ID), `email`, `name`, `exp` (expiration), `iss`, `aud`. After verification, you can trust these.                                                                                                                                 |

## The flow

```
User authenticates client (Claude Desktop, Cursor, etc.) with OIDC provider
        ↓
mcpx receives a JWT
        ↓
mcpx calls your MCP server, forwarding the JWT in the Authorization header
        ↓
Your server extracts the Bearer token from the header
        ↓
Your server fetches the OIDC provider's public keys (JWKS)
        ↓
Your server verifies the token's signature, issuer, audience, and expiration
        ↓
Your server reads the claims (sub, email, name, ...) and uses them as needed
```

## Building it step by step

### 1. Configure your OIDC provider details

Your server needs three pieces of information, typically from environment variables:

| Variable       | What it is                                | Example                                            |
| -------------- | ----------------------------------------- | -------------------------------------------------- |
| `JWKS_URI`     | URL of the provider's public key endpoint | `https://your-org.okta.com/oauth2/default/v1/keys` |
| `JWT_ISSUER`   | Expected value of the `iss` claim         | `https://your-org.okta.com/oauth2/default`         |
| `JWT_AUDIENCE` | Expected value of the `aud` claim         | `your-client-id`                                   |

In the example, `load_config()` reads these and fails fast if any are missing — the right pattern.

These values are expected to correspond to those that serve mcpx itself to handle authentication.

### 2. Extract the token from the request

The JWT arrives as `Bearer <token>` in the `Authorization` header. Extract it on each tool call — in the example, `extract_bearer_token()` handles this.

In FastMCP, you access headers inside a tool function with:

```python
headers = get_http_headers(include={"authorization"})
```

In other frameworks, use whatever gives you access to HTTP headers. The key point: **extract per-request**, not once at connection time.

### 3. Verify the token

This is the core of the security model. In the example, `verify_token()` does it all:

1. **Fetch the signing key** — `PyJWKClient(config.jwks_uri)` gets the public key matching the token's key ID. Most JWT libraries handle JWKS fetching and caching for you.

2. **Decode and verify** — Validate signature, issuer, audience, and expiration in one call:

   ```python
   claims = jwt.decode(
       token,
       signing_key.key,
       algorithms=["RS256"],
       issuer=config.issuer,
       audience=config.audience,
   )
   ```

3. **Extract claims** — Read `sub` (required — the unique user ID), plus `email` and `name` if available.

> **Why RS256?** OIDC providers sign tokens with RSA keys. You verify with the public key from JWKS — your server never needs any secrets from the provider.

### 4. Use the identity in your tools

The example's `whoami` tool just returns the identity. In a real server, you'd use it to query user data, check permissions, or audit actions.

### 5. Handle errors

Never silently ignore token problems — if the token is bad, the tool call should fail. Handle: missing header, bad signature, expired token, wrong issuer/audience, missing `sub` claim. In the example, the `whoami` tool catches JWT errors and re-raises them with a descriptive message.
