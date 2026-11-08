#!/bin/sh
set -e

APP_PID=""

log_entrypoint() {
    echo "$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ") ENTRYPOINT: $1"
}

is_container_privileged() {
    # CapEff in /proc/self/status is a hex bitmask of the process's effective
    # capabilities. A privileged container is granted (nearly) the full set,
    # while a default container gets a small subset. Counting the set bits and
    # comparing against a threshold tells the two apart without depending on the
    # `capsh` binary (from libcap), which is not installed in this image.
    cap_eff_hex=$(grep -m1 '^CapEff:' /proc/self/status 2>/dev/null | awk '{print $2}')
    [ -z "$cap_eff_hex" ] && return 1

    num_caps=0
    val=$((0x${cap_eff_hex}))
    while [ "$val" -ne 0 ]; do
        num_caps=$((num_caps + (val & 1)))
        val=$((val >> 1))
    done

    [ "$num_caps" -gt 36 ]
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

    echo "Cleanup finished."
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

# --- Trap signals for graceful shutdown ---
# Ensure cleanup runs on exit, regardless of how the script exits.
# Note: 'exit' trap is bash-specific, using TERM/INT/QUIT is more portable for sh.
trap 'echo "ENTRYPOINT: Signal INT received, cleaning up..."; cleanup; exit 130' INT
trap 'echo "ENTRYPOINT: Signal TERM received, cleaning up..."; cleanup; exit 143' TERM
trap 'echo "ENTRYPOINT: Signal QUIT received, cleaning up..."; cleanup; exit 131' QUIT

GENERATED_INSTANCE_ID="mcpx-$(hexdump -n 6 -v -e '/1 "%02x"' /dev/urandom | head -c 12)"
MCPX_VERSION="$(cat /tmp/version.env)"
export INSTANCE_ID="${GENERATED_INSTANCE_ID}"
export VERSION="${MCPX_VERSION}"

log_entrypoint "started, checking privileges..."

if is_container_privileged; then
    log_entrypoint "privileged=yes, waiting for docker..."
    wait_for_docker
    log_entrypoint "docker ready"
    export DIND_ENABLED="true"
else
    log_entrypoint "privileged=no, skipping docker"
    export DIND_ENABLED="false"
fi

log_entrypoint "launching app"

exec "$@" & # Run the main app in the background
APP_PID=$!
wait $APP_PID
APP_EXIT_CODE=$?

echo "Application (PID $APP_PID) exited with code $APP_EXIT_CODE."

exit $APP_EXIT_CODE
