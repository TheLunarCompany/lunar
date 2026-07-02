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
# (e.g. `su-exec lunar`) runs the server under it; the UI-only image has no
# su-exec and already runs as lunar, so it passes no prefix.
exec_ui() {
    exec "$@" serve "${UI_DIR}" -s -p "${UI_PORT}"
}

# Replace the current (sub)shell with mcpx-server, dropped to the unprivileged
# lunar user. The container runs as root so the in-pod dockerd can start;
# su-exec hands the process off to lunar.
exec_server() {
    cd "${SERVER_DIR}"
    exec su-exec "${LUNAR_USER}" node dist/index.js
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

        exec_ui su-exec "${LUNAR_USER}" &
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
