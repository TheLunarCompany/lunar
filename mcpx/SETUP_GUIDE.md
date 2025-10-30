# MCPX Self-Hosted Setup Guide

This guide explains how to build and run MCPX from the source repository with all services (UI, Gateway, and Control Plane) properly configured.

## Architecture Overview

MCPX uses an **all-in-one architecture** where a single Docker container runs:

1. **MCPX Server** (port 9000)
   - MCP Gateway - handles MCP protocol connections from clients
   - Control Plane API - REST endpoints for configuration management
   - WebSocket - real-time updates to the UI

2. **UI** (port 5173)
   - Web-based control plane interface
   - Manages MCP server connections
   - Monitors live traffic

3. **Metrics** (port 3000)
   - Prometheus metrics endpoint

## Important: No Separate API Service

Unlike what some configurations might suggest:
- There is **NO** separate control plane service
- All API endpoints are served by the MCPX server on port 9000
- Control plane routes are at the root level (e.g., `/system-state`, `/app-config`)
- There is **NO** `/api/` prefix on any routes

## Quick Start

### 1. Build and Run with Docker Compose

From the `/Users/eberry/Code/apps/lunar/mcpx` directory:

```bash
# Build the image (first time only, or when code changes)
docker compose build

# Start the container
docker compose up -d

# View logs
docker compose logs -f

# Stop the container
docker compose down
```

The services will be available at:
- **UI**: http://localhost:5173
- **MCPX Server**: http://localhost:9000
- **Metrics**: http://localhost:3000

### 2. Configure MCP Servers

Edit `./config/mcp.json` to add your MCP server connections:

```json
{
  "mcpServers": {
    "my-server": {
      "type": "sse",
      "url": "https://your-mcp-server.com/sse",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

Restart the container after configuration changes:
```bash
docker compose restart
```

## Production Deployment (DigitalOcean)

### Step 1: Build and Push to DigitalOcean

On your local machine:

```bash
# Build for your server architecture
docker buildx build --platform linux/amd64 -t mcpx-local:latest -f Dockerfile-all-in-one .

# Save and transfer to your server
docker save mcpx-local:latest | gzip > mcpx-local.tar.gz
scp mcpx-local.tar.gz root@your-server-ip:/root/
```

On your DigitalOcean server:
```bash
# Load the image
docker load < /root/mcpx-local.tar.gz

# Or clone the repo and build directly
cd /root
git clone https://github.com/TheLunarCompany/lunar.git
cd lunar/mcpx
docker compose build
```

### Step 2: Configure Docker Compose on Server

Create `/root/mcpx/docker-compose.yml` (same as local, but with production environment):

```yaml
version: "3.9"

services:
  mcpx:
    image: mcpx-local:latest
    container_name: mcpx
    privileged: true
    ports:
      - "127.0.0.1:9000:9000"  # Only expose to localhost
      - "127.0.0.1:5173:5173"  # Only expose to localhost
      - "127.0.0.1:3000:3000"  # Metrics
    volumes:
      - ./config:/lunar/packages/mcpx-server/config
    environment:
      LOG_LEVEL: "info"
      LUNAR_TELEMETRY: "false"
      ENABLE_CONTROL_PLANE_REST: "true"
      ENABLE_CONTROL_PLANE_STREAMING: "true"
    restart: unless-stopped
```

**Security Note**: Bind to `127.0.0.1` so services are only accessible via Nginx.

### Step 3: Configure Nginx

1. Install the WebSocket upgrade map:

```bash
sudo tee /etc/nginx/conf.d/websocket-upgrade.conf << 'EOF'
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
EOF
```

2. Create the site configuration:

Copy the `nginx-example.conf` to your server and install it:

```bash
sudo cp nginx-example.conf /etc/nginx/sites-available/mcpx
sudo ln -s /etc/nginx/sites-available/mcpx /etc/nginx/sites-enabled/mcpx
sudo nginx -t
sudo systemctl reload nginx
```

3. Get SSL certificate:

```bash
sudo certbot --nginx -d 1speed.mcp-gateway.xyz
```

### Step 4: Configure Cloudflare Access (Optional)

If you want to add authentication:

1. In Cloudflare dashboard: **Zero Trust** → **Access** → **Applications**
2. Create a new Self-hosted application
3. Add hostname: `1speed.mcp-gateway.xyz`
4. Add access policy (e.g., require email domain)

**Important**: When using Cloudflare Access, ensure the policy applies to the entire domain, not just specific paths, since the UI needs to access multiple endpoints.

### Step 5: Firewall Rules

```bash
# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Block direct access to MCPX ports
sudo ufw deny 9000/tcp
sudo ufw deny 5173/tcp
sudo ufw deny 3000/tcp

# Check status
sudo ufw status
```

## Troubleshooting

### "Connection to the MCPX server could not be established"

This error in the UI means the WebSocket connection failed. Check:

1. **WebSocket Configuration**: Verify the nginx `websocket-upgrade.conf` is loaded
2. **Proxy Headers**: Ensure `Upgrade` and `Connection` headers are set in nginx
3. **Network**: Check if port 9000 is accessible from nginx
4. **Logs**: Check MCPX logs with `docker compose logs -f`

```bash
# Test WebSocket connection
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  http://localhost:9000/ws
```

### Control Plane Shows "Not Connected"

This means the UI cannot reach the MCPX server. Check:

1. **MCPX Server Running**: `curl http://localhost:9000/healthcheck`
2. **Nginx Proxy**: `curl -I https://yourdomain.com/healthcheck`
3. **Browser Console**: Check for CORS or connection errors
4. **Network Tab**: See which requests are failing

### Routes Returning 404

Remember:
- Control plane routes are **NOT** under `/api/`
- Routes are at root level: `/system-state`, `/app-config`, etc.
- All routes are served by port 9000

Test the routes directly:
```bash
curl http://localhost:9000/system-state
curl http://localhost:9000/app-config
```

### SSL/TLS Issues

If using Cloudflare:

1. **SSL/TLS Mode**: Set to "Full (strict)" in Cloudflare dashboard
2. **Real IP**: Add Cloudflare IP ranges to nginx (see `nginx-example.conf` comments)

```bash
# Create cloudflare-realip.conf
sudo tee /etc/nginx/conf.d/cloudflare-realip.conf << 'EOF'
# Cloudflare IP ranges
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;
set_real_ip_from 2400:cb00::/32;
set_real_ip_from 2606:4700::/32;
set_real_ip_from 2803:f800::/32;
set_real_ip_from 2405:b500::/32;
set_real_ip_from 2405:8100::/32;
set_real_ip_from 2a06:98c0::/29;
set_real_ip_from 2c0f:f248::/32;
real_ip_header CF-Connecting-IP;
EOF

sudo nginx -t && sudo systemctl reload nginx
```

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `MCPX_PORT` | 9000 | MCPX server port |
| `UI_PORT` | 5173 | UI port |
| `SERVE_METRICS_PORT` | 3000 | Metrics port |
| `LOG_LEVEL` | info | Logging level (debug, info, warn, error) |
| `ENABLE_CONTROL_PLANE_REST` | true | Enable REST API |
| `ENABLE_CONTROL_PLANE_STREAMING` | true | Enable WebSocket/SSE |
| `LUNAR_TELEMETRY` | true | Send telemetry to Lunar |
| `LUNAR_URL` | - | Lunar Hub URL (optional) |
| `LUNAR_API_KEY` | - | Lunar Hub API key (optional) |
| `CORS_ORIGINS` | * | Allowed CORS origins |
| `ALLOWED_IP_RANGES` | - | IP allowlist (CIDR format) |

## Connecting Clients

### Claude Desktop

Edit your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "mcpx": {
      "type": "sse",
      "url": "https://1speed.mcp-gateway.xyz/sse"
    }
  }
}
```

### Cursor

In Cursor settings, add:

```json
{
  "mcp": {
    "servers": {
      "mcpx": {
        "url": "https://1speed.mcp-gateway.xyz/sse"
      }
    }
  }
}
```

## Additional Resources

- [Official MCPX Documentation](https://docs.lunar.dev/mcpx/get_started)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Lunar GitHub Repository](https://github.com/TheLunarCompany/lunar)

## Support

For issues specific to MCPX:
- GitHub Issues: https://github.com/TheLunarCompany/lunar/issues
- Documentation: https://docs.lunar.dev/

For Nginx/SSL/Infrastructure issues:
- DigitalOcean Community: https://www.digitalocean.com/community
- Nginx Documentation: https://nginx.org/en/docs/
