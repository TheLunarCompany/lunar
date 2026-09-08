#!/bin/bash

# Build and run the combined mcpx image (server + bundled UI) for local use.
# This is the `mcpx` target of the multi-stage Dockerfile - the same image the
# CI multi-build produces. (Dockerfile-all-in-one was retired; see
# .github/workflows/_archive for its deprecated workflows.)

set -e

echo "Building mcpx image (server + UI)..."
docker build --target mcpx -t mcpx -f Dockerfile .

echo "Stopping and removing existing container if it exists..."
docker stop mcpx 2>/dev/null || true
docker rm mcpx 2>/dev/null || true

# --privileged enables Docker-in-Docker for container ("docker") MCP servers.
echo "Running mcpx container..."
docker run -d --privileged --name mcpx \
  -p 9000:9000 \
  -p 3000:3000 \
  -p 5173:5173 \
  mcpx

echo "Container started successfully!"
echo "Ports exposed:"
echo "  - MCPX Server: http://localhost:9000"
echo "  - Metrics: http://localhost:3000"
echo "  - UI: http://localhost:5173"

echo ""
echo "To check container status: docker ps"
echo "To view logs: docker logs mcpx"
echo "To stop container: docker stop mcpx"
