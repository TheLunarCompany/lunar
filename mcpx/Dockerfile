# syntax=docker/dockerfile:1
# check=skip=SecretsUsedInArgOrEnv
#
# Build targets summary:
#   UI only:
#     docker build -t mcpx-ui --target mcpx-ui -f ./Dockerfile ./mcpx
#     docker run --rm -p 5173:5173 mcpx-ui
#   MCPX server:
#     docker build -t mcpx-server --target mcpx-server -f ./Dockerfile ./mcpx
#     docker run --rm -p 9000:9000 -p 3000:3000 mcpx-server
#   Combined (server + UI):
#     docker build -t mcpx --target mcpx -f ./Dockerfile ./mcpx
#     docker run --rm -p 9000:9000 -p 5173:5173 -p 3000:3000 mcpx

FROM node:22.17.1-alpine3.21 AS base

ENV HOME=/lunar

WORKDIR ${HOME}

COPY ./packages ./packages
COPY ./package.json ./package.json
COPY ./package-lock.json ./package-lock.json
COPY ./scripts/generate-config.sh ./scripts/generate-config.sh
COPY ./build-deps.sh ./build-deps.sh
COPY ./.version ./.version
COPY ./rootfs ./rootfs

RUN chmod +x ./rootfs/usr/local/bin/entrypoint.sh && \
    chmod +x ./rootfs/usr/local/bin/startup.sh

RUN chmod +x ./build-deps.sh

# Read version from .version file and set as build arg
RUN VERSION_VALUE=$(cat .version | tr -d '\n') && \
    echo "${VERSION_VALUE}" > /tmp/version.env

# Create cache directories and install dependencies once
RUN npm run build:deps && npm install
RUN npm run install:mcpx-server && npm run build:mcpx-server

WORKDIR ${HOME}/packages/ui
COPY scripts/generate-config.sh generate-config.sh

# Fix ARM64/x64 rollup platform dependencies issue for Alpine/musl
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then \
        npm install @rollup/rollup-linux-arm64-musl --save-dev --no-audit --no-fund 2>/dev/null || true; \
    else \
        npm install @rollup/rollup-linux-x64-musl --save-dev --no-audit --no-fund 2>/dev/null || true; \
    fi

WORKDIR ${HOME}
RUN npm run install:ui && npm run build:ui

FROM node:22.17.1-alpine3.21 AS mcpx-ui
ARG UI_PORT

ENV LOG_LEVEL="info"
ENV BUILD_SCOPE="ui"
ENV UI_PORT=${UI_PORT:-5173}

ENV VITE_MCPX_SERVER_URL=""
ENV VITE_MCPX_SERVER_PORT=""
ENV VITE_WS_URL=""
ENV VITE_ENABLE_LOGIN=false

ENV LUNAR_USER=lunar
ENV LUNAR_USER_UID=1002
ENV LUNAR_USER_GID=1002
ENV LUNAR_USER_GROUP=${LUNAR_USER}:${LUNAR_USER}
ENV HOME=/${LUNAR_USER}

WORKDIR ${HOME}/packages/ui

COPY --from=base --chown=${LUNAR_USER_GROUP} ${HOME}/packages/ui/dist ./
COPY --from=base --chown=${LUNAR_USER_GROUP} ${HOME}/rootfs/usr/local/bin/startup.sh /usr/local/bin/startup.sh
COPY --from=base --chown=${LUNAR_USER_GROUP} ${HOME}/scripts/generate-config.sh /usr/local/bin/generate-config.sh

RUN npm install -g serve
CMD ["/usr/local/bin/startup.sh"]

RUN addgroup -g ${LUNAR_USER_GID} -S ${LUNAR_USER} && \
    adduser -u ${LUNAR_USER_UID} -S -D -G ${LUNAR_USER} -h ${HOME} -s /sbin/nologin ${LUNAR_USER} && \
    chown -R ${LUNAR_USER}:${LUNAR_USER} ${HOME} && \
    mkdir -p /var/log/${LUNAR_USER}

USER ${LUNAR_USER}
EXPOSE ${UI_PORT}

FROM docker:28.3.2-dind-alpine3.22 AS mcpx-server
ARG UI_PORT
ARG MCPX_SERVER_PORT
ARG SERVE_METRICS_PORT
ARG MCPX_PORT
ARG TARGETPLATFORM
ARG BUILDPLATFORM
ARG LOKI_HOST="log-collector-dev.lunar.dev"
ARG LOKI_USER=""
ARG LOKI_PASSWORD=""

# ---- Environment variables ----
ENV UI_PORT=${UI_PORT:-5173}
ENV UI_URL=http://127.0.0.1:${UI_PORT}
ENV LUNAR_USER=lunar
ENV LUNAR_USER_UID=1002
ENV LUNAR_USER_GID=1002
ENV LUNAR_USER_GROUP=${LUNAR_USER}:${LUNAR_USER}
ENV HOME=/${LUNAR_USER}
ENV MCPX_SERVER_PORT=${MCPX_SERVER_PORT:-9000}

ENV BUILD_SCOPE="mcpx"
ENV LUNAR_TELEMETRY=true
ENV LUNAR_CONSUMER_NAME="mcpx-anonymous"
ENV LUNAR_URL="https://hosted-gateway.lunar.dev"
ENV LUNAR_API_KEY=""
ENV EXCLUDED_DESTINATIONS="log-collector.lunar.dev,log-collector-stg.lunar.dev,log-collector-dev.lunar.dev,dl-cdn.alpinelinux.org,deb.debian.org,security.debian.org,registry.npmjs.org,auth.docker.io,registry-1.docker.io,production0.cloudflare.docker.com,mcpx-ui,pypi.org,files.pythonhosted.org,archive.ubuntu.com,security.ubuntu.com,mirrors.ubuntu.com,mirrorlist.centos.org,mirror.centos.org,vault.centos.org,cdn.redhat.com,access.redhat.com,mirrors.fedoraproject.org"

ENV SERVE_METRICS_PORT=${SERVE_METRICS_PORT:-3000}

ENV MCPX_PORT=${MCPX_PORT:-9000}
ENV ENABLE_CONTROL_PLANE_STREAMING=true
ENV ENABLE_CONTROL_PLANE_REST=true
ENV MCPX_SERVER_URL=""

ENV MITM_PROXY_LISTEN_PORT=8081
ENV MITM_PROXY_LISTEN_HOST=0.0.0.0
ENV VERSION=""
ENV INSTANCE_ID=""

ENV INTERCEPTION_USER=lunar_interception
ENV INTERCEPTION_USER_UID=1001
ENV INTERCEPTION_USER_GID=1001

ENV SHARED_GROUP_NAME=lunar_group
ENV SHARED_GROUP_GID=1050
ENV LUNAR_USER_SHARED_GROUP=${LUNAR_USER}:${SHARED_GROUP_NAME}
ENV LOKI_HOST=${LOKI_HOST}
ENV LOKI_USER=${LOKI_USER}
ENV LOKI_PASSWORD=${LOKI_PASSWORD}
ENV MITM_PROXY_CONF_DIR=/home/${INTERCEPTION_USER}/.proxy

ENV GITHUB_OAUTH_CLIENT_ID="Ov23liD20079SUBdPqvh"
ENV PYTHONWARNINGS="ignore::UserWarning"
ENV UV_CACHE_DIR=${HOME}/.cache/uv
ENV UV_DATA_DIR=${HOME}/.local/share/uv
ENV UV_TOOL_DIR=${HOME}/.local/bin
ENV UV_PYTHON_INSTALL_DIR=${HOME}/.local/share/uv/python
ENV NPM_CONFIG_USERCONFIG=${HOME}/.npm/
ENV NPM_CONFIG_CACHE=${NPM_CONFIG_USERCONFIG}
ENV DOCKER_CONFIG=${HOME}/.docker
ENV PIP_NO_CACHE_DIR=1
ENV PIP_USE_PEP517=1
ENV CARGO_HOME=/tmp/cargo
ENV RUSTUP_HOME=/tmp/rustup
ENV PATH="/tmp/cargo/bin:${UV_TOOL_DIR}:${PATH}"
ENV DIND_ENABLED=true
ENV INTERCEPTION_ENABLED=true
# ---- Environment variables ----

WORKDIR ${HOME}

RUN apk add --no-cache \
    nodejs=22.16.0-r2 \
    npm=11.6.4-r0

# Log build platform information for debugging
RUN echo "Building on: $BUILDPLATFORM for: $TARGETPLATFORM" && \
    echo "Architecture: $(uname -m)" && \
    echo "Kernel: $(uname -r)"

RUN apk add --no-cache \
    python3=3.12.12-r0 \
    py3-pip=25.1.1-r0 \
    uv=0.7.22-r0 \
    iptables=1.8.11-r1 \
    ipset=7.24-r0 \
    libcap=2.76-r0 \
    su-exec=0.2-r3 \
    ca-certificates=20250911-r0 \
    mitmproxy=11.0.0-r0 \
    gcc=14.2.0-r6 \
    musl-dev=1.2.5-r10 \
    python3-dev=3.12.12-r0 \
    linux-headers=6.14.2-r0 \
    rust=1.87.0-r0 \
    cargo=1.87.0-r0

# Install supervisor with pinned setuptools to avoid pkg_resources warning
RUN pip3 install --no-cache-dir --break-system-packages 'setuptools<81' supervisor==4.2.5

RUN \
    addgroup -g ${LUNAR_USER_GID} -S ${LUNAR_USER} && \
    adduser -u ${LUNAR_USER_UID} -S -D -G ${LUNAR_USER} -h ${HOME} -s /sbin/nologin ${LUNAR_USER} && \
    addgroup -S docker || true && \
    addgroup -g ${INTERCEPTION_USER_GID} -S ${INTERCEPTION_USER} && \
    adduser -u ${INTERCEPTION_USER_UID} -S -D -G ${INTERCEPTION_USER} -h ${HOME}/${INTERCEPTION_USER} -s /sbin/nologin ${INTERCEPTION_USER} && \
    addgroup -g ${SHARED_GROUP_GID} -S ${SHARED_GROUP_NAME} && \
    addgroup ${LUNAR_USER} ${SHARED_GROUP_NAME} && \
    addgroup ${INTERCEPTION_USER} ${SHARED_GROUP_NAME} && \
    addgroup ${LUNAR_USER} docker || true

RUN \
    mkdir -p ${UV_CACHE_DIR} ${UV_DATA_DIR} ${UV_TOOL_DIR} ${UV_PYTHON_INSTALL_DIR} ${NPM_CONFIG_USERCONFIG} ${MITM_PROXY_CONF_DIR} ${DOCKER_CONFIG} && \
    mkdir -p /var/log/${LUNAR_USER} ${HOME} ${HOME}/${INTERCEPTION_USER} && \
    chown -R root:${SHARED_GROUP_NAME} /var/log/${LUNAR_USER} || true && \
    chown -R ${LUNAR_USER}:${LUNAR_USER} ${HOME} && \
    chown -R ${INTERCEPTION_USER}:${INTERCEPTION_USER} ${HOME}/${INTERCEPTION_USER}

RUN mkdir -p ${UV_CACHE_DIR} ${UV_DATA_DIR} ${UV_TOOL_DIR} ${UV_PYTHON_INSTALL_DIR} && \
    mkdir -p ${HOME}/${INTERCEPTION_USER}/.lunar/mitmproxy_conf && \
    chown -R ${INTERCEPTION_USER}:${INTERCEPTION_USER} ${HOME}/${INTERCEPTION_USER}/.lunar && \
    chmod -R 755 ${NPM_CONFIG_USERCONFIG}

WORKDIR ${HOME}

COPY --from=base /tmp/version.env /tmp/version.env
COPY --from=base --chown=${LUNAR_USER_SHARED_GROUP} ${HOME}/packages/shared-model/dist packages/shared-model/dist
COPY --from=base --chown=${LUNAR_USER_SHARED_GROUP} ${HOME}/packages/shared-model/package.json packages/shared-model/package.json
COPY --from=base --chown=${LUNAR_USER_SHARED_GROUP} ${HOME}/packages/toolkit-core/dist packages/toolkit-core/dist
COPY --from=base --chown=${LUNAR_USER_SHARED_GROUP} ${HOME}/packages/toolkit-core/package.json packages/toolkit-core/package.json
COPY --from=base --chown=${LUNAR_USER_SHARED_GROUP} ${HOME}/packages/webapp-protocol/dist packages/webapp-protocol/dist
COPY --from=base --chown=${LUNAR_USER_SHARED_GROUP} ${HOME}/packages/webapp-protocol/package.json packages/webapp-protocol/package.json
COPY --from=base --chown=${LUNAR_USER_SHARED_GROUP} ${HOME}/packages/toolkit-ui/dist packages/toolkit-ui/dist
COPY --from=base --chown=${LUNAR_USER_SHARED_GROUP} ${HOME}/packages/toolkit-ui/package.json packages/toolkit-ui/package.json
COPY --from=base --chown=${LUNAR_USER_SHARED_GROUP} ${HOME}/packages/mcpx-server/dist/src packages/mcpx-server/dist
COPY --from=base --chown=${LUNAR_USER_SHARED_GROUP} ${HOME}/packages/mcpx-server/package.json packages/mcpx-server/package.json
COPY --from=base --chown=${LUNAR_USER_SHARED_GROUP} ${HOME}/node_modules node_modules
COPY --from=base --chown=${LUNAR_USER_SHARED_GROUP} ${HOME}/rootfs /

EXPOSE ${MCPX_PORT} ${SERVE_METRICS_PORT}
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/usr/local/bin/startup.sh"]

FROM mcpx-server AS mcpx

ENV BUILD_SCOPE="all"

COPY --from=base --chown=${LUNAR_USER_SHARED_GROUP} ${HOME}/scripts/generate-config.sh /usr/local/bin/generate-config.sh
COPY --from=base --chown=${LUNAR_USER_SHARED_GROUP} ${HOME}/packages/ui/dist packages/ui

RUN npm install -g serve --cache /tmp/empty-cache

EXPOSE ${UI_PORT}
