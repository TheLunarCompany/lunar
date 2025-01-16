#!/bin/bash

echo "Setting up logrotate configuration and cron job..."

# Load valid assigments environment variables
eval "$(/command/s6-envdir /var/run/lunar_env env | grep -E '^[a-zA-Z_][a-zA-Z0-9_]*=')"

echo "Defining CRON_SCHEDULE by LOG_ROTATE_INTERVAL: $LOG_ROTATE_INTERVAL"

# Define the cron job schedule based on the LOG_ROTATE_INTERVAL environment variable
case "$LOG_ROTATE_INTERVAL" in
  "5min")
    CRON_SCHEDULE="*/5 * * * *"
    ;;
  "10min")
    CRON_SCHEDULE="*/10 * * * *"
    ;;
  "30min")
    CRON_SCHEDULE="*/30 * * * *"
    ;;
  "hourly"|"")
    CRON_SCHEDULE="0 * * * *"
    ;;
  "daily")
    CRON_SCHEDULE="0 0 * * *"
    ;;
  "weekly")
    CRON_SCHEDULE="0 0 * * 0"
    ;;
  "monthly")
    CRON_SCHEDULE="0 0 1 * *"
    ;;
  *)
    echo "Unknown LOG_ROTATE_INTERVAL: $LOG_ROTATE_INTERVAL. Defaulting to hourly."
    CRON_SCHEDULE="0 * * * *"
    ;;
esac

echo "Setting up logrotate cron job with schedule: $CRON_SCHEDULE"

# Create the cron job in the user's crontab.
(echo "$CRON_SCHEDULE /usr/sbin/logrotate -f /etc/logrotate.d/lunar_gateway --state /var/lib/logrotate/status") | sudo crontab -

LOG_ROTATE_SIZE="${LOG_ROTATE_SIZE:-10M}"
LOG_ROTATE_RETAIN="${LOG_ROTATE_RETAIN:-3}"

echo "Setting up logrotate configuration with size: $LOG_ROTATE_SIZE and retain: $LOG_ROTATE_RETAIN"

# Overwrite the default logrotate configuration based on environment variables
sudo tee /etc/logrotate.d/lunar_gateway > /dev/null <<EOF
/var/log/lunar-proxy/*.log /var/log/squid/*.log {
  size ${LOG_ROTATE_SIZE}
  rotate ${LOG_ROTATE_RETAIN}
  missingok
  notifempty
  compress
  sharedscripts
  postrotate
      [ ! -x /usr/lib/rsyslog/rsyslog-rotate ] || /usr/lib/rsyslog/rsyslog-rotate
      su -c "test ! -e /run/squid.pid || test ! -x /usr/sbin/squid || /usr/sbin/squid -k rotate" lunar 2>/dev/null
  endscript
}
EOF

echo "Logrotate and cron job setup complete."