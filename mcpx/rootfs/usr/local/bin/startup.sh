#!/bin/sh
#
# Container command: launches the process(es) for the current build scope.
# BUILD_SCOPE is set per target in mcpx/Dockerfile:
#   ui   -> mcpx-ui target      (UI only)
#   all  -> mcpx target         (UI + server)
#   mcpx -> mcpx-server target  (server only)
#
set -eu

UI_DIR="${HOME}/packages/ui"
SERVER_DIR="${HOME}/packages/mcpx-server"

log() {
    echo "STARTUP: $*"
}

# Regenerate the UI's runtime config.json from the current environment.
generate_config() {
    /usr/local/bin/generate-config.sh
}

# Replace the current (sub)shell with the UI static file server. `-s` rewrites
# unknown routes to index.html for the single-page app. Any prefix passed in
# (e.g. the DROP_PRIV su-exec prefix) runs the server under it; the UI-only
# image has no su-exec and already runs as lunar, so it passes no prefix.
exec_ui() {
    exec "$@" serve "${UI_DIR}" -s -p "${UI_PORT}"
}

# When started as root (needed for the in-pod dockerd), su-exec hands child
# processes off to the unprivileged lunar user. Under a restricted pod
# securityContext the container already starts non-root and su-exec would
# crash on setgroups, so no prefix is used.
if [ "$(id -u)" -eq 0 ]; then
    DROP_PRIV="su-exec ${LUNAR_USER}"
else
    DROP_PRIV=""
fi

# Node sizes its heap at roughly half the container memory limit, so a 512Mi
# pod gets a ~256MB heap and dies on V8 OOM (exit 134) with half the pod unused.
# Size the heap to 75% of the limit instead. Every bail-out logs why.
heap_node_options() {
    case "${NODE_OPTIONS:-}" in
        *max-old-space-size*)
            log "NODE_OPTIONS already sets a heap size, leaving it as is"
            return
            ;;
    esac

    # Where the limit lives depends on the cgroup setup:
    #   v2 without a cgroup namespace: /sys/fs/cgroup/<own path>/memory.max
    #   v2 with a cgroup namespace:    /sys/fs/cgroup/memory.max
    #   v1:                            /sys/fs/cgroup/memory/memory.limit_in_bytes
    own_cgroup="$(sed -n 's/^0::\(.*\)$/\1/p' /proc/self/cgroup 2>/dev/null)"
    limit_bytes=""
    for limit_file in "/sys/fs/cgroup${own_cgroup}/memory.max" \
                      /sys/fs/cgroup/memory.max \
                      /sys/fs/cgroup/memory/memory.limit_in_bytes; do
        value="$(cat "${limit_file}" 2>/dev/null || true)"
        case "${value}" in
            ''|*[!0-9]*) continue ;;    # missing, or "max" meaning unlimited
        esac
        limit_bytes="${value}"
        break
    done

    if [ -z "${limit_bytes}" ]; then
        log "no cgroup memory limit found, keeping the default V8 heap"
        return
    fi
    if [ "${limit_bytes}" -gt 68719476736 ]; then
        log "cgroup memory limit ${limit_bytes} means unlimited, keeping the default V8 heap"
        return
    fi

    heap_mb=$(( limit_bytes * 3 / 4 / 1048576 ))
    log "sizing V8 heap to ${heap_mb}MB (75% of ${limit_bytes} bytes from ${limit_file})"
    export NODE_OPTIONS="${NODE_OPTIONS:+${NODE_OPTIONS} }--max-old-space-size=${heap_mb}"
}

# Replace the current (sub)shell with mcpx-server, running as lunar.
exec_server() {
    cd "${SERVER_DIR}"
    heap_node_options
    # shellcheck disable=SC2086 # intentional word splitting of the prefix
    exec ${DROP_PRIV} node dist/index.js
}

case "${BUILD_SCOPE}" in
    ui)
        # UI-only image: already runs as lunar and has no su-exec binary.
        log "starting UI"
        generate_config
        exec_ui
        ;;

    all)
        # All-in-one image: run the UI and server side by side, both as lunar.
        # The server is primary; when it exits we stop the UI and let the
        # container exit so Kubernetes restarts the pod.
        log "starting MCPX server + UI"
        generate_config

        # shellcheck disable=SC2086 # intentional word splitting of the prefix
        exec_ui ${DROP_PRIV} &
        ui_pid=$!

        exec_server &
        server_pid=$!

        trap 'kill "${ui_pid}" "${server_pid}" 2>/dev/null || true' INT TERM

        server_exit=0
        wait "${server_pid}" || server_exit=$?

        kill "${ui_pid}" 2>/dev/null || true
        wait "${ui_pid}" 2>/dev/null || true
        exit "${server_exit}"
        ;;

    mcpx)
        # Server-only image.
        log "starting MCPX server"
        exec_server
        ;;

    *)
        echo "STARTUP ERROR: unknown BUILD_SCOPE '${BUILD_SCOPE}'" >&2
        exit 1
        ;;
esac
