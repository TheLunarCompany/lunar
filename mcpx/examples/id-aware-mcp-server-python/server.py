"""
Identity-aware MCP server example (stdio transport).

A stdio MCP server that receives a JWT via _meta on each tool call,
verifies it against a JWKS endpoint, and exposes user claims via a `whoami` tool.

The identity flows through the MCP protocol itself (_meta), not HTTP headers,
so this works over any transport — including stdio.

Configuration (env vars):
    JWKS_URI      - JWKS endpoint URL (e.g. https://accounts.google.com/.well-known/jwks.json)
    JWT_ISSUER    - Expected issuer claim
    JWT_AUDIENCE  - Expected audience claim
"""

from __future__ import annotations

import json
import logging
import os
import sys
from dataclasses import dataclass
from typing import Any

import jwt
from dotenv import load_dotenv
from fastmcp import FastMCP, Context
from fastmcp.exceptions import ToolError
from jwt import PyJWKClient

logging.basicConfig(stream=sys.stderr, level=logging.DEBUG, format="[id-aware] %(message)s")
logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class JwtConfig:
    jwks_uri: str
    issuer: str
    audience: str


@dataclass(frozen=True)
class UserIdentity:
    sub: str
    email: str | None
    name: str | None
    roles: list[str]


def load_config() -> JwtConfig:
    jwks_uri = os.environ.get("JWKS_URI")
    issuer = os.environ.get("JWT_ISSUER")
    audience = os.environ.get("JWT_AUDIENCE")

    missing = [
        var
        for var, val in [
            ("JWKS_URI", jwks_uri),
            ("JWT_ISSUER", issuer),
            ("JWT_AUDIENCE", audience),
        ]
        if not val
    ]
    if missing:
        raise RuntimeError(
            f"Missing required environment variables: {', '.join(missing)}"
        )

    return JwtConfig(jwks_uri=jwks_uri, issuer=issuer, audience=audience)  # type: ignore[arg-type]


def verify_token(
    token: str, config: JwtConfig, jwks_client: PyJWKClient
) -> UserIdentity:
    """Verify a JWT token against the JWKS endpoint and return user identity."""
    signing_key = jwks_client.get_signing_key_from_jwt(token)
    claims: dict[str, Any] = jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        issuer=config.issuer,
        audience=config.audience,
    )

    sub = claims.get("sub")
    if not sub:
        raise ValueError("Token missing required 'sub' claim")

    return UserIdentity(
        sub=sub,
        email=claims.get("email"),
        name=claims.get("name"),
        roles=claims.get("roles", []),
    )


def extract_bearer_token(authorization: str) -> str | None:
    """Extract the Bearer token from an Authorization value."""
    if authorization.startswith("Bearer "):
        return authorization.removeprefix("Bearer ").strip() or None
    return None


def build_server(config: JwtConfig) -> FastMCP:
    mcp = FastMCP("id-aware-server")
    jwks_client = PyJWKClient(config.jwks_uri)

    @mcp.tool()
    async def whoami(ctx: Context) -> str:  # pyright: ignore[reportUnusedFunction]
        """Returns the identity of the authenticated user from the JWT token passed in _meta."""
        request_context = ctx.request_context
        if not request_context:
            raise ValueError("No request context available")

        meta = request_context.meta
        if not meta:
            raise ValueError(
                "No _meta provided in tool call. "
                "Expected _meta.authorization to contain a Bearer token."
            )
        authorization: Any = getattr(meta, "authorization", None)
        if not authorization or not isinstance(authorization, str):
            raise ValueError(
                "No authorization token provided in _meta. "
                "Expected _meta.authorization to contain a Bearer token."
            )

        token = extract_bearer_token(authorization)
        if not token:
            raise ValueError("Invalid authorization format. Expected: Bearer <token>")

        # NOTE: These are from the unverified token — values may be attacker-controlled.
        # Safe for debug logging, but don't use for access decisions before verification.
        unverified_header = jwt.get_unverified_header(token)
        unverified_payload = jwt.decode(token, options={"verify_signature": False})
        logger.debug("JWT kid=%s, iss=%s, sub=%s", unverified_header.get("kid"), unverified_payload.get("iss"), unverified_payload.get("sub"))
        logger.debug("Verifying against JWKS_URI=%s, expected issuer=%s, audience=%s", config.jwks_uri, config.issuer, config.audience)

        try:
            identity = verify_token(token, config, jwks_client)
        except (
            jwt.InvalidTokenError,
            jwt.exceptions.PyJWKClientError,
            ValueError,
        ) as e:
            logger.error("Token verification failed: %s", e)
            raise ToolError(f"Token verification failed: {e}") from e

        return json.dumps({
            "sub": identity.sub,
            "email": identity.email,
            "name": identity.name,
            "roles": identity.roles,
        })

    return mcp


def main() -> None:
    load_dotenv()
    config = load_config()
    logger.info("JWKS URI:  %s", config.jwks_uri)
    logger.info("Issuer:    %s", config.issuer)
    logger.info("Audience:  %s", config.audience)
    mcp = build_server(config)
    mcp.run(transport="stdio")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
