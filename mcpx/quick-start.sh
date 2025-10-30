#!/bin/bash
set -e

# MCPX Quick Start Script
# This script helps you get MCPX up and running quickly

echo "🚀 MCPX Quick Start"
echo "===================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first:"
    echo "   https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first:"
    echo "   https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Check if we're in the right directory
if [ ! -f "Dockerfile-all-in-one" ]; then
    echo "❌ Error: Dockerfile-all-in-one not found"
    echo "   Please run this script from the mcpx directory"
    exit 1
fi

# Check if config directory exists
if [ ! -d "config" ]; then
    echo "📁 Creating config directory..."
    mkdir -p config
    echo "✅ Config directory created"
fi

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml not found"
    echo "   Please ensure docker-compose.yml is in the current directory"
    exit 1
fi

echo ""
echo "Select an option:"
echo "1) Build and start MCPX (first time or after code changes)"
echo "2) Start MCPX (if already built)"
echo "3) Stop MCPX"
echo "4) View logs"
echo "5) Rebuild from scratch"
echo "6) Clean up (remove container and image)"
echo ""
read -p "Enter your choice (1-6): " choice

case $choice in
    1)
        echo ""
        echo "🏗️  Building MCPX image..."
        echo "⏳ This may take 5-10 minutes on first build..."
        docker compose build

        echo ""
        echo "🚀 Starting MCPX..."
        docker compose up -d

        echo ""
        echo "✅ MCPX is starting!"
        echo ""
        echo "Services will be available at:"
        echo "  📱 UI:           http://localhost:5173"
        echo "  🔌 MCPX Server:  http://localhost:9000"
        echo "  📊 Metrics:      http://localhost:3000"
        echo ""
        echo "View logs with: docker compose logs -f"
        echo ""
        ;;

    2)
        echo ""
        echo "🚀 Starting MCPX..."
        docker compose up -d

        echo ""
        echo "✅ MCPX is starting!"
        echo ""
        echo "Services will be available at:"
        echo "  📱 UI:           http://localhost:5173"
        echo "  🔌 MCPX Server:  http://localhost:9000"
        echo "  📊 Metrics:      http://localhost:3000"
        echo ""
        echo "View logs with: docker compose logs -f"
        echo ""
        ;;

    3)
        echo ""
        echo "🛑 Stopping MCPX..."
        docker compose down
        echo "✅ MCPX stopped"
        echo ""
        ;;

    4)
        echo ""
        echo "📋 Showing logs (Ctrl+C to exit)..."
        docker compose logs -f
        ;;

    5)
        echo ""
        echo "🧹 Cleaning up old build..."
        docker compose down
        docker rmi mcpx-local:latest 2>/dev/null || true

        echo ""
        echo "🏗️  Building MCPX image from scratch..."
        echo "⏳ This may take 5-10 minutes..."
        docker compose build --no-cache

        echo ""
        echo "🚀 Starting MCPX..."
        docker compose up -d

        echo ""
        echo "✅ MCPX is starting!"
        echo ""
        echo "Services will be available at:"
        echo "  📱 UI:           http://localhost:5173"
        echo "  🔌 MCPX Server:  http://localhost:9000"
        echo "  📊 Metrics:      http://localhost:3000"
        echo ""
        echo "View logs with: docker compose logs -f"
        echo ""
        ;;

    6)
        echo ""
        echo "🧹 Cleaning up MCPX..."
        docker compose down
        docker rmi mcpx-local:latest 2>/dev/null || true
        echo "✅ MCPX cleaned up"
        echo ""
        ;;

    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

# Health check
if [ "$choice" == "1" ] || [ "$choice" == "2" ]; then
    echo "⏳ Waiting for MCPX to be ready..."
    sleep 5

    max_attempts=30
    attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:9000/healthcheck > /dev/null 2>&1; then
            echo "✅ MCPX is healthy and ready!"
            echo ""
            echo "🎉 You can now access:"
            echo "   • Control Plane UI: http://localhost:5173"
            echo "   • MCPX API: http://localhost:9000"
            echo ""
            echo "Next steps:"
            echo "1. Configure your MCP servers in ./config/mcp.json"
            echo "2. Restart MCPX: docker compose restart"
            echo "3. Connect your MCP client to: http://localhost:9000/sse"
            echo ""
            break
        fi

        attempt=$((attempt + 1))
        echo "   Attempt $attempt/$max_attempts..."
        sleep 2
    done

    if [ $attempt -eq $max_attempts ]; then
        echo "⚠️  MCPX is taking longer than expected to start"
        echo "   Check logs with: docker compose logs -f"
        echo ""
    fi
fi
