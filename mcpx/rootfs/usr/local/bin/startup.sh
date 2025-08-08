#!/bin/sh
set -e

# Inject runtime configuration into UI
/usr/local/bin/inject-runtime-config.sh

SUPERVISORD_CONF_FILE="/etc/supervisor/conf.d/supervisord.conf"

if [ "$INTERCEPTION_ENABLED" = "true" ]; then
    SUPERVISORD_CONF_FILE="/etc/supervisor/conf.d/supervisord_mitm.conf"
fi

echo "Starting supervisord..."
exec supervisord -c "$SUPERVISORD_CONF_FILE"
