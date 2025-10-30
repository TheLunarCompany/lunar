# MCPX Architecture Notes

## Key Insights from Code Analysis

### 1. All-in-One Container Architecture

MCPX is designed as a **single, unified container** that runs all components:

```
┌─────────────────────────────────────────────┐
│         Docker Container (privileged)       │
│                                             │
│  ┌────────────────────────────────────┐    │
│  │   Supervisor (Process Manager)     │    │
│  │                                    │    │
│  │  ┌──────────────────────────┐     │    │
│  │  │  MCPX Server (port 9000) │     │    │
│  │  │  • MCP Gateway           │     │    │
│  │  │  • Control Plane REST    │     │    │
│  │  │  • WebSocket Server      │     │    │
│  │  │  • OAuth Handlers        │     │    │
│  │  └──────────────────────────┘     │    │
│  │                                    │    │
│  │  ┌──────────────────────────┐     │    │
│  │  │  UI (port 5173)          │     │    │
│  │  │  • React SPA             │     │    │
│  │  │  • Served by 'serve'     │     │    │
│  │  └──────────────────────────┘     │    │
│  │                                    │    │
│  └────────────────────────────────────┘    │
│                                             │
│  • Docker-in-Docker (DinD)                 │
│  • mitmproxy (traffic interception)        │
│                                             │
└─────────────────────────────────────────────┘
```

### 2. No Separate API Service

**Critical Understanding**: There is NO separate control plane API service!

❌ **Wrong Architecture (What You Might Think)**:
```
UI (5173) → MCPX Gateway (9000) + Control Plane API (9001)
```

✅ **Actual Architecture**:
```
UI (5173) → MCPX Server (9000)
                ├─ MCP Protocol (/mcp, /sse)
                ├─ Control Plane REST (/system-state, /app-config, /target-server)
                ├─ OAuth (/oauth/callback)
                └─ WebSocket (/ws)
```

### 3. Control Plane Routes

**Routes are at ROOT level**, not under `/api/`:

#### Actual Routes (from `control-plane.ts`):
```
GET    /system-state           - Get system state
GET    /app-config            - Get application config
PATCH  /app-config            - Update application config
POST   /target-server         - Add MCP server
PATCH  /target-server/:name   - Update MCP server
DELETE /target-server/:name   - Remove MCP server
POST   /auth/initiate/:name   - Initiate OAuth flow
GET    /auth/callback         - OAuth callback
```

#### Gateway Routes (from `streamable.ts`, `sse.ts`):
```
POST   /mcp                   - MCP protocol over HTTP
GET    /sse                   - MCP protocol over SSE
```

#### Other Routes:
```
GET    /healthcheck          - Health check
GET    /oauth/callback       - OAuth callback handler
WS     /ws                   - WebSocket for UI updates
GET    /metrics              - Prometheus metrics (port 3000)
```

### 4. Environment Variables

**Key Environment Variables** (from `Dockerfile-all-in-one`):

#### Control Plane Enablement:
```dockerfile
ENV ENABLE_CONTROL_PLANE_STREAMING=true
ENV ENABLE_CONTROL_PLANE_REST=true
```

These are **enabled by default** in the Dockerfile!

#### Port Configuration:
```dockerfile
ENV MCPX_PORT=9000              # MCPX server (gateway + control plane)
ENV UI_PORT=5173                # UI
ENV SERVE_METRICS_PORT=3000     # Metrics
```

### 5. Code Flow

#### Server Initialization (`index.ts`):
```typescript
// 1. Load configuration
const configService = new ConfigService(config, logger);

// 2. Initialize services
const services = new Services(configService, meterProvider, logger);

// 3. Build server with all routes
const mcpxServer = await buildMcpxServer(
  configService,
  services,
  allowedIpRanges,
  logger,
);

// 4. Listen on MCPX_PORT (9000)
await mcpxServer.listen(MCPX_PORT);
```

#### Route Mounting (`build-server.ts`):
```typescript
const app = express();

// All routes are mounted at root level:
app.use(buildOAuthRouter(...));           // /oauth/*
app.use(buildAuthMcpxRouter(...));        // /auth/mcpx/*
app.use(buildStreamableHttpRouter(...));  // /mcp
app.use(buildSSERouter(...));             // /sse
app.use(buildAdminRouter(...));           // /admin/*
app.use(buildControlPlaneRouter(...));    // /system-state, /app-config, etc.

bindUIWebsocket(server, ...);            // /ws (WebSocket)
```

### 6. UI Communication

The UI connects to the MCPX server using:

1. **HTTP Requests** - For REST API calls
2. **WebSocket** - For real-time updates
3. **Configuration** - Via `config.json` generated at startup

#### Configuration Priority (`api-config.ts`):
```typescript
// 1. VITE_MCPX_SERVER_URL (if set, use as full URL)
// 2. Construct from window.location + VITE_MCPX_SERVER_PORT
// 3. Default: same hostname + port 9000
```

**Example**: If UI is at `https://1speed.mcp-gateway.xyz`, it will try to connect to:
- `https://1speed.mcp-gateway.xyz:9000` (if separate port)
- OR `https://1speed.mcp-gateway.xyz` (if proxied through same hostname)

### 7. Supervisor Configuration

The container uses `supervisord` to manage processes:

```ini
[program:mcpx-server]
command=node dist/index.js
directory=/lunar/packages/mcpx-server
port=9000

[program:ui]
command=serve . -s -p 5173
directory=/lunar/packages/ui
```

### 8. Build Process

The `Dockerfile-all-in-one` performs:

1. **Builder Stage**:
   - Install Node.js dependencies
   - Build shared packages (shared-model, toolkit-core, webapp-protocol)
   - Build mcpx-server (TypeScript → JavaScript)
   - Build UI (Vite → static files)

2. **Runner Stage**:
   - Install Docker-in-Docker
   - Install mitmproxy (for traffic interception)
   - Install supervisor (process manager)
   - Copy built artifacts
   - Set up users and permissions
   - Configure environment

### 9. Common Misconceptions

#### ❌ Misconception 1: "The control plane is a separate service on port 9001"
**Reality**: Everything is on port 9000. Port 9001 was never used in the official build.

#### ❌ Misconception 2: "I need to proxy `/api/*` to a separate service"
**Reality**: Routes are at root level (`/system-state`, etc.), not under `/api/`.

#### ❌ Misconception 3: "I need three separate containers (UI, Gateway, API)"
**Reality**: One container runs everything via supervisor.

#### ❌ Misconception 4: "The prebuilt image is missing the control plane"
**Reality**: The prebuilt image includes everything. Connection issues are usually networking/proxy related.

### 10. Why It Might Not Work

Common issues from your ChatGPT conversation:

1. **Nginx Proxying `/api/*` to Port 9001**
   - Port 9001 doesn't exist (or isn't serving anything)
   - Should proxy specific routes to port 9000

2. **Missing WebSocket Upgrade Headers**
   - Nginx must set `Upgrade` and `Connection` headers
   - Required for UI WebSocket connection

3. **CORS Issues**
   - UI and MCPX must be on same origin OR
   - CORS must be configured correctly

4. **SSL Termination**
   - If using Nginx SSL termination, must set `X-Forwarded-Proto` header
   - UI needs to know the protocol for WebSocket URL construction

### 11. Correct Nginx Configuration

```nginx
# UI (all other routes)
location / {
    proxy_pass http://127.0.0.1:5173;
    # WebSocket headers for hot reload
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
}

# MCPX Server (specific routes only)
location ~ ^/(mcp|sse|system-state|app-config|target-server|auth|oauth|healthcheck|ws) {
    proxy_pass http://127.0.0.1:9000;
    # WebSocket and SSE headers
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_buffering off;  # Important for SSE
}
```

### 12. Security Considerations

The container runs as **privileged** by default because:

1. **Docker-in-Docker** - Required to run MCP servers in containers
2. **iptables** - For traffic interception via mitmproxy
3. **Network Configuration** - For proxy setup

**Production Recommendations**:
- Run behind Nginx (never expose ports directly)
- Use Cloudflare Access or similar for authentication
- Set `ALLOWED_IP_RANGES` to restrict access
- Enable `AUTH_KEY` for API authentication
- Use `LUNAR_TELEMETRY=false` if you don't want telemetry

### 13. Development vs Production

#### Development (Local):
```yaml
ports:
  - "9000:9000"  # Expose directly
  - "5173:5173"  # Expose directly
```

#### Production (Server):
```yaml
ports:
  - "127.0.0.1:9000:9000"  # Localhost only
  - "127.0.0.1:5173:5173"  # Localhost only
# Nginx handles external access
```

---

## References

- Code Analysis: `/Users/eberry/Code/apps/lunar/mcpx`
- Dockerfile: `Dockerfile-all-in-one`
- Server Code: `packages/mcpx-server/src/`
- UI Code: `packages/ui/src/`
- Supervisor Config: `rootfs/etc/supervisor/conf.d/supervisord.conf`
