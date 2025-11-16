#!/bin/sh
set -e


generate_config() {
    /usr/local/bin/generate-config.sh
}

check_build_scope(build_scope) {
    if [ "$BUILD_SCOPE" = "$build_scope" ]; then
        return 0
    fi
    return 1
}

is_ui() {
    return check_build_scope "ui"
}

is_all_in_one() {
    return check_build_scope "all"
}

generate_config_postfix() {
    CONFIG_POSTFIX=""

    if [ "$INTERCEPTION_ENABLED" = "true" ]; then
        CONFIG_POSTFIX="${CONFIG_POSTFIX}_mitm"
    fi
    if [ "$BUILD_SCOPE" = "mcpx" ]; then
        CONFIG_POSTFIX="${CONFIG_POSTFIX}_noui"
    fi

    echo "${CONFIG_POSTFIX}"
}

start_ui() {
    generate_config
    exec serve /${HOME}/packages/ui -s -p ${UI_PORT}
}

start_mcpx() {
    if is_all_in_one; then
        generate_config
    fi

    SUPERVISORD_CONF_FILE="/etc/supervisor/conf.d/supervisord$(generate_config_postfix).conf"

    echo "Starting supervisord..."
    exec supervisord -c "${SUPERVISORD_CONF_FILE}"
}

if is_ui; then
    echo "Starting UI..."
    start_ui
else
    echo "Starting MCPX..."
    start_mcpx
fi
