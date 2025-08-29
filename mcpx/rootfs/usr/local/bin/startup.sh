#!/bin/sh
set -e

SUPERVISORD_CONF_FILE="/etc/supervisor/conf.d/supervisord.conf"

if [ "$INTERCEPTION_ENABLED" = "true" ]; then
    SUPERVISORD_CONF_FILE="/etc/supervisor/conf.d/supervisord_mitm.conf"
fi

echo "Starting supervisord..."
exec supervisord -c "$SUPERVISORD_CONF_FILE"
