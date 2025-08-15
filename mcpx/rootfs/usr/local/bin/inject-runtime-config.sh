#!/bin/sh

# This script injects runtime configuration into the built UI files
# by creating a runtime configuration file that overrides build-time defaults

UI_DIR="/lunar/packages/ui"
CONFIG_FILE="$UI_DIR/runtime-config.js"

# Set defaults if environment variables are not set
PUBLIC_HOST=${PUBLIC_HOST:-127.0.0.1}
WEBSERVER_PORT=${WEBSERVER_PORT:-9001}
PUBLIC_HOST_SUPPORT_TLS=${PUBLIC_HOST_SUPPORT_TLS:-false}

# Basic sanitization to prevent script injection
PUBLIC_HOST=$(echo "$PUBLIC_HOST" | sed 's/[^a-zA-Z0-9.-]//g')
WEBSERVER_PORT=$(echo "$WEBSERVER_PORT" | sed 's/[^0-9]//g')

# Determine protocol scheme based on TLS support
if [ "$PUBLIC_HOST_SUPPORT_TLS" = "true" ]; then
  HTTP_SCHEME="https"
  WS_SCHEME="wss"
else
  HTTP_SCHEME="http"
  WS_SCHEME="ws"
fi

# Create a runtime configuration file that the UI can load
cat > "$CONFIG_FILE" << EOF
window.RUNTIME_CONFIG = {
  VITE_API_SERVER_URL: "${HTTP_SCHEME}://${PUBLIC_HOST}:${WEBSERVER_PORT}",
  VITE_WS_URL: "${WS_SCHEME}://${PUBLIC_HOST}:${WEBSERVER_PORT}"
};
EOF

echo "Runtime configuration injected into $CONFIG_FILE"
echo "  API Server URL: ${HTTP_SCHEME}://${PUBLIC_HOST}:${WEBSERVER_PORT}"
echo "  WebSocket URL: ${WS_SCHEME}://${PUBLIC_HOST}:${WEBSERVER_PORT}"
