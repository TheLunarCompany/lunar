# MCPX Configuration Directory

This directory contains configuration files for your MCPX instance.

## Files

### app.yaml
General MCPX application configuration including:
- Authentication settings
- Server settings
- OAuth provider configurations
- Logging settings

### mcp.json
MCP server connections configuration. Define your upstream MCP servers here.

## MCP Server Types

MCPX supports multiple connection types:

### 1. SSE (Server-Sent Events)
```json
{
  "mcpServers": {
    "my-sse-server": {
      "type": "sse",
      "url": "https://example.com/mcp/sse",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

### 2. Streamable HTTP
```json
{
  "mcpServers": {
    "my-http-server": {
      "type": "streamable-http",
      "url": "https://example.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

### 3. stdio (Local process)
```json
{
  "mcpServers": {
    "my-local-server": {
      "type": "stdio",
      "command": "python",
      "args": ["-m", "my_mcp_server"],
      "env": {
        "API_KEY": "your-key"
      }
    }
  }
}
```

### 4. Docker
```json
{
  "mcpServers": {
    "my-docker-server": {
      "type": "docker",
      "image": "my-mcp-image:latest",
      "env": {
        "API_KEY": "your-key"
      }
    }
  }
}
```

## OAuth Configuration

For servers requiring OAuth, add provider details in app.yaml:

```yaml
oauth:
  providers:
    github:
      type: "oauth"
      client_id: "your-client-id"
      client_secret: "your-client-secret"
      authorization_url: "https://github.com/login/oauth/authorize"
      token_url: "https://github.com/login/oauth/access_token"
      scopes: ["repo", "user"]
```

Then reference it in mcp.json:

```json
{
  "mcpServers": {
    "github-server": {
      "type": "sse",
      "url": "https://api.github.com/mcp",
      "oauth": {
        "provider": "github"
      }
    }
  }
}
```

## References

- [Official MCPX Documentation](https://docs.lunar.dev/mcpx/get_started)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
