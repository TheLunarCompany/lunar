"""
Identity-aware MCP server example.

A streamable-HTTP MCP server that receives a JWT in the Authorization header,
verifies it against a JWKS endpoint, and exposes user claims via a `whoami` tool.

Configuration (env vars):
    JWKS_URI      - JWKS endpoint URL (e.g. https://accounts.google.com/.well-known/jwks.json)
    JWT_ISSUER    - Expected issuer claim
    JWT_AUDIENCE  - Expected audience claim
    PORT          - Server port (default: 3001)
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any

import jwt
from dotenv import load_dotenv
from fastmcp import FastMCP
from fastmcp.server.dependencies import get_http_headers
from jwt import PyJWKClient


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
    )


def extract_bearer_token(headers: dict[str, str]) -> str | None:
    """Extract the Bearer token from the Authorization header."""
    auth_value = headers.get("authorization", "")
    if auth_value.startswith("Bearer "):
        return auth_value.removeprefix("Bearer ").strip() or None
    return None


def build_server(config: JwtConfig) -> FastMCP:
    mcp = FastMCP("id-aware-server")
    jwks_client = PyJWKClient(config.jwks_uri)

    @mcp.tool()
    async def whoami() -> str:  # pyright: ignore[reportUnusedFunction]
        """Returns the identity of the authenticated user from the JWT token passed in the Authorization header."""
        headers = get_http_headers(include={"authorization"})
        token = extract_bearer_token(headers)
        if not token:
            raise ValueError("No authorization token provided")

        try:
            identity = verify_token(token, config, jwks_client)
        except (jwt.InvalidTokenError, jwt.exceptions.PyJWKClientError, ValueError) as e:
            raise ValueError(f"Token verification failed: {e}") from e

        return json.dumps(
            {"sub": identity.sub, "email": identity.email, "name": identity.name},
        )

    return mcp


def main() -> None:
    load_dotenv()
    config = load_config()
    print(f"JWKS URI:  {config.jwks_uri}")
    print(f"Issuer:    {config.issuer}")
    print(f"Audience:  {config.audience}")
    mcp = build_server(config)
    port = int(os.environ.get("PORT", "4050"))
    print(f"Listening on port {port}")
    mcp.run(transport="http", host="0.0.0.0", port=port)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
