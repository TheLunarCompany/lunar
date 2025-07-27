#!/bin/sh
set -e

MITM_PROXY_PID=""
APP_PID=""

is_container_privileged() {
    num_caps=$(capsh --print | grep "Current:" | tr ',' '\n' | grep -c "cap_")
    num_caps_op2=$(capsh --print | grep "Bounding set =" | tr ',' '\n' | grep -c "cap_")
    if [ "$num_caps" -gt 36 ] || [ "$num_caps_op2" -gt 36 ]; then
        return 0
    else
        return 1
    fi
}

is_cap_admin_enabled() {
    cap_admin=$(capsh --print | grep "Current:" | grep -c "cap_net_admin")
    cap_admin_op2=$(capsh --print | grep "Bounding set =" | grep -c "cap_net_admin")

    if [ "$cap_admin" -gt 0 ] || [ "$cap_admin_op2" -gt 0 ]; then
        return 0
    else
        return 1
    fi
}

cleanup() {
    echo "Cleanup called..."
    if [ -n "$APP_PID" ]; then
        echo "Attempting to stop application (PID $APP_PID)..."
        # Send TERM, then wait a bit, then KILL if still alive
        kill "$APP_PID" >/dev/null 2>&1
        sleep 0.5
        ( kill -0 "$APP_PID" >/dev/null 2>&1 && kill -9 "$APP_PID" >/dev/null 2>&1 ) || true
        wait "$APP_PID" 2>/dev/null || true
        echo "Application stopped."
        APP_PID=""
    fi

    if [ -n "$MITM_PROXY_PID" ]; then
        echo "Attempting to stop mitmproxy (PID $MITM_PROXY_PID)..."
        kill "$MITM_PROXY_PID" >/dev/null 2>&1
        sleep 0.5
        ( kill -0 "$MITM_PROXY_PID" >/dev/null 2>&1 && kill -9 "$MITM_PROXY_PID" >/dev/null 2>&1 ) || true
        wait "$MITM_PROXY_PID" 2>/dev/null || true
        echo "mitmproxy stopped."
        MITM_PROXY_PID=""
    fi

    echo "Cleanup finished."
}

resolve_host_ips() {
  host="$1"
  if [ -z "$host" ]; then
    echo "Usage: resolve_host_ips <hostname>" >&2
    return 1
  fi

  nslookup "$host" 2>/dev/null \
    | awk '/^Address: / { print $2 }' \
    | grep -Eo '([0-9]{1,3}\.){3}[0-9]{1,3}' \
    || echo "" # Output empty string if no IPv4 found to prevent issues with loops
}

wait_for_docker() {
    if ! pgrep -f "dockerd" > /dev/null 2>&1; then
        if [ -f /var/run/docker.pid ]; then
            rm -f /var/run/docker.pid
        fi
    
        dockerd --config-file=/etc/docker/daemon.json > /var/log/dockerd.log 2>&1 &
    fi

    WAIT_TIMEOUT=30
    WAIT_INTERVAL=3
    elapsed_time=0
    while ! docker info > /dev/null 2>&1; do
        if [ "$elapsed_time" -ge "$WAIT_TIMEOUT" ]; then
            echo "ENTRYPOINT ERROR: Docker daemon did not become ready within $WAIT_TIMEOUT seconds."
            echo "Architecture: $ARCH"
            echo "Docker daemon status:"
            ps aux | grep -v grep | grep docker || echo "(no docker processes found)"
            echo "Docker daemon logs:"
            tail -n 30 /var/log/dockerd.log 2>/dev/null || echo "(no dockerd log found)"
            echo "System info:"
            uname -a
            echo "Available space:"
            df -h /var/lib/docker 2>/dev/null || df -h /
            return 1
        fi
        sleep "$WAIT_INTERVAL"
        elapsed_time=$((elapsed_time + WAIT_INTERVAL))
    done
    return 0
}

init_interception() {
    echo "ENTRYPOINT: Initializing traffic interception..."


    # --- Configuration Variables ---
    # mitmproxy settings
    MITM_PROXY_LISTEN_PORT="${MITM_PROXY_LISTEN_PORT:-8081}"
    export MITM_PROXY_ADDON_SCRIPT="/etc/mcpx/interception/lunar_selective_addon.py"
    MITM_PROXY_CONF_DIR_BASE="${MITM_PROXY_CONF_DIR_BASE:-/home/${INTERCEPTION_USER}/.lunar}"
    export MITM_PROXY_CONF_DIR="${MITM_PROXY_CONF_DIR_BASE}/mitmproxy_conf"
    export MITM_PROXY_CA_CERT_PATH="${MITM_PROXY_CONF_DIR}/mitmproxy-ca-cert.pem"
    export MITM_PROXY_LOG_FILE="/var/log/${LUNAR_USER:-lunar}/lunar_interception.log"
    export MITM_PROXY_ERROR_LOG_FILE="/var/log/${LUNAR_USER:-lunar}/lunar_interception_error.log"

    # iptables and networking settings
    IPSET_NAME_V4="lunar_exclude_ipv4"

    if is_container_privileged; then
        echo 1 > /proc/sys/net/ipv4/ip_forward
    fi

    if ! su-exec "${INTERCEPTION_USER}" test -f "${MITM_PROXY_CONF_DIR}"; then
        # Ensure the base directory exists with proper permissions
        mkdir -p "${MITM_PROXY_CONF_DIR_BASE}"
        chown -R "${INTERCEPTION_USER}:${INTERCEPTION_USER}" "${MITM_PROXY_CONF_DIR_BASE}"
        chmod -R 755 "${MITM_PROXY_CONF_DIR_BASE}"
        
        su-exec "${INTERCEPTION_USER}" \
            timeout 10s mitmdump --quiet \
            --set "confdir=${MITM_PROXY_CONF_DIR}" \
            --listen-host 127.0.0.1 --listen-port 9999 & # Dummy port for CA gen
        MITMDUMP_GEN_PID=$!

        for _ in $(seq 1 20); do
            if su-exec "${INTERCEPTION_USER}" test -f "$MITM_PROXY_CA_CERT_PATH"; then
                break
            fi
            sleep 0.5
        done

        kill $MITMDUMP_GEN_PID >/dev/null 2>&1 || true; sleep 0.5
        ( kill -0 $MITMDUMP_GEN_PID >/dev/null 2>&1 && kill -9 $MITMDUMP_GEN_PID >/dev/null 2>&1 ) || true
        wait $MITMDUMP_GEN_PID 2>/dev/null || true

        if ! su-exec "${INTERCEPTION_USER}" test -f "$MITM_PROXY_CA_CERT_PATH"; then
            echo "CRITICAL ERROR: Failed to generate lunar CA as ${INTERCEPTION_USER} at ${MITM_PROXY_CA_CERT_PATH}."
            exit 1
        fi
    fi

    # Make certificate readable by all processes
    chmod 644 "$MITM_PROXY_CA_CERT_PATH"
    
    cp "$MITM_PROXY_CA_CERT_PATH" "/mitmproxy-ca-cert.pem"
    chmod 644 "/mitmproxy-ca-cert.pem"
    
    if command -v update-ca-certificates > /dev/null; then
        cp "$MITM_PROXY_CA_CERT_PATH" "/usr/local/share/ca-certificates/proxy_lunar.crt"
        update-ca-certificates
    elif command -v update-ca-trust > /dev/null; then
        cp "$MITM_PROXY_CA_CERT_PATH" "/etc/pki/ca-trust/source/anchors/proxy_lunar.crt"
        update-ca-trust extract
    else
        echo "WARNING: Could not update system CA certificates automatically."
    fi

    if [ -n "$NODE_EXTRA_CA_CERTS" ]; then
        export NODE_EXTRA_CA_CERTS="$NODE_EXTRA_CA_CERTS:$MITM_PROXY_CA_CERT_PATH"
    else
        export NODE_EXTRA_CA_CERTS="$MITM_PROXY_CA_CERT_PATH"
    fi

    if ipset list -n | grep -qx "$IPSET_NAME_V4"; then
        echo "Flushing ipset: $IPSET_NAME_V4"
        ipset flush "$IPSET_NAME_V4"
    else
        if ! ipset create "${IPSET_NAME_V4}" hash:net family inet; then
            echo "  CRITICAL ERROR: Failed to create ipset '${IPSET_NAME_V4}'. Exiting."
            exit 1
        fi
    fi

    # Add user-defined EXCLUDED_DESTINATIONS
    if [ -n "$EXCLUDED_DESTINATIONS" ]; then
        OLD_IFS_LOOP="$IFS"
        IFS=','
        for dest_item_raw in $EXCLUDED_DESTINATIONS; do
            dest_item=$(echo "$dest_item_raw" | awk '{$1=$1};1')
            if [ -z "$dest_item" ]; then continue; fi

            if echo "$dest_item" | grep -Eq '^([0-9]{1,3}\.){3}[0-9]{1,3}(\/[0-9]{1,2})?$'; then
                if ! ipset -q add "${IPSET_NAME_V4}" "$dest_item"; then continue; fi
            else
                resolve_host_ips "$dest_item" | while IFS= read -r ip_line || [ -n "$ip_line" ]; do
                    ip=$(echo "$ip_line" | awk '{$1=$1};1')
                    if [ -n "$ip" ]; then
                        if ! ipset -q add "${IPSET_NAME_V4}" "$ip"; then continue; fi
                    fi
                done
            fi
        done
        IFS="$OLD_IFS_LOOP"
    fi

    # --- IPTables Rules ---
    iptables -t nat -F PREROUTING
    iptables -t nat -A PREROUTING -m set --match-set "$IPSET_NAME_V4" dst -j RETURN

    iptables -t nat -A OUTPUT -o lo -j RETURN
    iptables -t nat -A OUTPUT -m set --match-set "$IPSET_NAME_V4" dst -j RETURN
    iptables -t nat -A OUTPUT -p tcp -m owner --uid-owner "$(id -u "${INTERCEPTION_USER}")" -j RETURN
    iptables -t nat -A OUTPUT -p tcp -j REDIRECT --to-port "$MITM_PROXY_LISTEN_PORT"

    iptables -t nat -A POSTROUTING -j MASQUERADE


    unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy NO_PROXY no_proxy
}

init_interception_if_needed() {
    if [ -z "$LUNAR_URL" ]; then
        echo "ENTRYPOINT: LUNAR_URL not set. Skipping traffic interception."
        return
    fi

    case "$LUNAR_URL" in
        http://*|https://*)
            ;;
        *)
            echo "ENTRYPOINT Warning: LUNAR_URL must start with http:// or https://. Skipping traffic interception."
            return
            ;;
    esac

    if [[ "$LUNAR_URL" == *.lunar.dev ]]; then
        if [ -z "$LUNAR_API_KEY" ]; then
            return
        fi
    fi

    if ! is_cap_admin_enabled; then
        echo "ENTRYPOINT Warning: Insufficient capabilities for traffic interception. Skipping traffic interception."
        echo "                    Please run the container with --cap-add=NET_ADMIN (or the equivalent for your orchestrator)."
        return
    fi

    init_interception
    export INTERCEPTION_ENABLED="true"
}

# --- Trap signals for graceful shutdown ---
# Ensure cleanup runs on exit, regardless of how the script exits.
# Note: 'exit' trap is bash-specific, using TERM/INT/QUIT is more portable for sh.
trap 'echo "ENTRYPOINT: Signal INT received, cleaning up..."; cleanup; exit 130' INT
trap 'echo "ENTRYPOINT: Signal TERM received, cleaning up..."; cleanup; exit 143' TERM
trap 'echo "ENTRYPOINT: Signal QUIT received, cleaning up..."; cleanup; exit 131' QUIT

GENERATED_INSTANCE_ID="mcpx-$(hexdump -n 6 -v -e '/1 "%02x"' /dev/urandom | head -c 12)"
MCPX_VERSION="$(cat /tmp/version.env)"
export INSTANCE_ID="${INSTANCE_ID:-${GENERATED_INSTANCE_ID}}"
export VERSION="${VERSION:-${MCPX_VERSION}}"
export INTERCEPTION_ENABLED="false"

if is_container_privileged; then
    wait_for_docker
    export DIND_ENABLED="true"
else
    export DIND_ENABLED="false"
fi

init_interception_if_needed

exec "$@" & # Run the main app in the background
APP_PID=$!
wait $APP_PID
APP_EXIT_CODE=$?

echo "Application (PID $APP_PID) exited with code $APP_EXIT_CODE."

if [ "$INTERCEPTION_ENABLED" = "true" ]; then
    echo "Application finished, performing final cleanup..."
    cleanup
fi

exit $APP_EXIT_CODE
