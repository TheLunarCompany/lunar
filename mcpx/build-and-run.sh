#!/bin/bash

# Build and run mcpx all-in-one Docker container

set -e

echo "Building mcpx-all-in-one Docker image..."
docker build -f Dockerfile-all-in-one -t mcpx-all-in-one .

echo "Stopping and removing existing container if it exists..."
docker stop mcpx-all-in-one 2>/dev/null || true
docker rm mcpx-all-in-one 2>/dev/null || true

echo "Running mcpx-all-in-one container..."
docker run -d --privileged --name mcpx-all-in-one \
  -p 9000:9000 \
  -p 9001:9001 \
  -p 3000:3000 \
  -p 5173:5173 \
  mcpx-all-in-one

echo "Container started successfully!"
echo "Ports exposed:"
echo "  - MCPX Server: http://localhost:9000"
echo "  - Webserver: http://localhost:9001"
echo "  - Metrics: http://localhost:3000"
echo "  - UI: http://localhost:5173"

echo ""
echo "To check container status: docker ps"
echo "To view logs: docker logs mcpx-all-in-one"
echo "To stop container: docker stop mcpx-all-in-one"