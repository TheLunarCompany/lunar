#!/bin/sh

# Build script for mcpx dependencies

set -e  # Exit on error

echo "Building mcpx dependencies..."

# Build toolkit-core
echo "Building @mcpx/toolkit-core..."
npm run build --workspace=packages/toolkit-core

# Build shared-model
echo "Building @mcpx/shared-model..."
npm run build --workspace=packages/shared-model

# Build webapp-protocol
echo "Building @mcpx/webapp-protocol..."
npm run build --workspace=packages/webapp-protocol

echo "All dependencies built successfully!"
