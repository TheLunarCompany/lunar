FROM golang:1.22 AS lunar_engine_build

ARG TIER=free
ENV TIER=${TIER}

WORKDIR /lunar
COPY ./src/libs ./src/libs
COPY ./src/services/lunar-engine ./src/services/lunar-engine
WORKDIR /lunar/src/services/lunar-engine
RUN go clean && go build -tags ${TIER} -o engine .

FROM golang:1.22 AS async_service_build

ARG TIER=free
ENV TIER=${TIER}

WORKDIR /lunar
COPY ./src/libs ./src/libs
COPY ./src/services/ ./src/services/

WORKDIR /lunar/src/services/async-service
RUN go clean && go build -tags ${TIER} -o async-service .

FROM golang:1.22 AS output_aggregation_build

WORKDIR /lunar
COPY ./src/libs ./src/libs
COPY ./src/services/aggregation-output-plugin ./src/services/aggregation-output-plugin

WORKDIR /lunar/src/services/aggregation-output-plugin
RUN go build -buildmode=c-shared -o output_aggregation.so .

FROM ubuntu:22.04

LABEL maintainer="Lunar <support@lunar.dev>"

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ARG LUNAR_VERSION
ARG S6_OVERLAY_VERSION=3.2.0.2
ARG JQ_VERSION=4.34.1
ARG TARGETARCH
ARG AWS_ACCESS_KEY_ID
ARG AWS_SECRET_ACCESS_KEY
ARG LUNAR_REDIRECTION_BY_QUERY_PARAMS
ARG LUNAR_FLUSH_SECONDS
ARG LUNAR_EXPORTER_S3_TOTAL_FILE_SIZE
ARG LUNAR_EXPORTER_S3_UPLOAD_TIMEOUT
ARG LUNAR_EXPORTER_S3_RETRY_LIMIT
ARG LUNAR_SYSLOG_INPUT_BUFFER_CHUNK_SIZE
ARG LUNAR_SYSLOG_INPUT_BUFFER_MAX_SIZE
ARG DD_API_KEY

ENV GATEWAY_INSTANCE_ID=""
ENV REDIS_URL=""
ENV LUNAR_VERSION=${LUNAR_VERSION}
ENV LUNAR_MANAGED=false
ENV LOG_LEVEL=ERROR
ENV HUB_REPORT_INTERVAL=15
ENV LUNAR_TELEMETRY=true
ENV LUNAR_TELEMETRY_SERVER_HOST=127.0.0.1
ENV LUNAR_TELEMETRY_SERVER_PORT=55142
ENV LUNAR_TELEMETRY_LOG_LEVEL=info
ENV AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
ENV AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
ENV LUNAR_FLUSH_SECONDS=${LUNAR_FLUSH_SECONDS:-10}
ENV LUNAR_EXPORTER_S3_TOTAL_FILE_SIZE=${LUNAR_EXPORTER_S3_TOTAL_FILE_SIZE:-"100M"}
ENV LUNAR_EXPORTER_S3_UPLOAD_TIMEOUT=${LUNAR_EXPORTER_S3_UPLOAD_TIMEOUT:-"5M"}
ENV LUNAR_EXPORTER_S3_RETRY_LIMIT=${LUNAR_EXPORTER_S3_RETRY_LIMIT:-5}
ENV LUNAR_SYSLOG_INPUT_BUFFER_CHUNK_SIZE=${LUNAR_SYSLOG_INPUT_BUFFER_CHUNK_SIZE:-256000}
ENV LUNAR_SYSLOG_INPUT_BUFFER_MAX_SIZE=${LUNAR_SYSLOG_INPUT_BUFFER_MAX_SIZE:-512000}
ENV LUNAR_HUB_URL="hub.lunar.dev"
ENV LUNAR_HUB_SCHEME="ws"
ENV LUNAR_API_KEY=""
ENV LUNAR_ENGINE_FAILSAFE_ENABLED="true"
ENV LUNAR_STREAMS_ENABLED="true"
ENV TLS_PASSTHROUGH_ON="false"
ENV LUNAR_EXPORTER_S3_KEY_FORMAT="/"
ENV LUNAR_EXPORTER_S3_MINIO_KEY_FORMAT="/"
ENV LUNAR_ACCESS_LOGS_OUTPUT="NULL"
ENV LUNAR_PROXY_CONFIG_DIR="/etc/lunar-proxy"
ENV LUNAR_PROXY_INTERNAL_CONFIG_DIR="/etc/lunar-proxy-internal"
ENV LUNAR_PROXY_LOGS_DIR="/var/log/lunar-proxy"
# TIKTOKEN_CACHE_DIR is used by the tiktoken to to cache the token dictionary
ENV TIKTOKEN_CACHE_DIR="/etc/tiktoken_cache"
ENV HAPROXY_CONFIG_DIR="/etc/haproxy"
ENV LUNAR_SPOE_CONFIG="${HAPROXY_CONFIG_DIR}/spoe/lunar.conf"
ENV LUNAR_CERT_DIRECTORY="${LUNAR_PROXY_CONFIG_DIR}/certs"
ENV TLS_CERT_DIRECTORY="${LUNAR_CERT_DIRECTORY}/tls"
ENV MTLS_CERT_DIRECTORY="${LUNAR_CERT_DIRECTORY}/mtls"
ENV TLS_CERT_PATH=""
ENV LUNAR_HAPROXY_CONFIG="${HAPROXY_CONFIG_DIR}/haproxy.cfg"
ENV LUNAR_FLOWS_PATH_PARAM_DIR="${LUNAR_PROXY_CONFIG_DIR}/path_params"
ENV LUNAR_FLOWS_PATH_PARAM_CONFIG="${LUNAR_PROXY_INTERNAL_CONFIG_DIR}/path_param_conf.yaml"
ENV LUNAR_PROXY_POLICIES_CONFIG="${LUNAR_PROXY_CONFIG_DIR}/policies.yaml"
ENV LUNAR_PROXY_CONFIG="$LUNAR_PROXY_CONFIG_DIR/gateway_config.yaml"
ENV LUNAR_PROXY_METRICS_CONFIG="${LUNAR_PROXY_CONFIG_DIR}/metrics.yaml"
ENV LUNAR_PROXY_METRICS_CONFIG_DEFAULT="${LUNAR_PROXY_INTERNAL_CONFIG_DIR}/metrics.yaml"
ENV LUNAR_PROXY_FLOW_DIRECTORY="${LUNAR_PROXY_CONFIG_DIR}/flows"
ENV LUNAR_PROXY_PROCESSORS_DIRECTORY="${LUNAR_PROXY_INTERNAL_CONFIG_DIR}/processors"
ENV LUNAR_PROXY_QUOTAS_DIRECTORY="${LUNAR_PROXY_CONFIG_DIR}/quotas"
ENV LUNAR_PROXY_USER_PROCESSORS_DIRECTORY="${LUNAR_PROXY_CONFIG_DIR}/user_processors"
ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/opt/fluent-bit/bin
ENV BIND_PORT=8000
ENV TLS_PASSTHROUGH_PORT=8001
ENV ENGINE_ADMIN_PORT=8081
ENV LUNAR_HEALTHCHECK_PORT=8040
ENV LUNAR_MAXCONN=4096
ENV GATEWAY_BUFFER_SIZE=32768
ENV LUNAR_ACCESS_LOG_METRICS_COLLECTION_TIME_INTERVAL_SEC=5

# AsyncService
ENV ASYNC_SERVICE_BIND_PORT=8010
ENV ASYNC_SERVICE_PORT=8111
ENV ASYNC_SERVICE_WORKERS=50
ENV ASYNC_SERVICE_IDLE_SEC=1
ENV ASYNC_SERVICE_REMOVE_COMPLETED_REQUESTS_AFTER_MIN=10
ENV ASYNC_SERVICE_REMOVE_RETRIEVED_RESPONSE_AFTER_MIN=10

# Proxy timeouts
ENV LUNAR_CONNECT_TIMEOUT_SEC=50
ENV LUNAR_CLIENT_TIMEOUT_SEC=50
ENV LUNAR_SERVER_TIMEOUT_SEC=50

# SPOE timeouts
ENV LUNAR_SPOE_HELLO_TIMEOUT_MS=1200
ENV LUNAR_SPOE_PROCESSING_TIMEOUT_SEC=30

# LUA timeouts
ENV LUNAR_RETRY_REQUEST_TIMEOUT_SEC=100

# Diagnosis Failsafe
ENV DIAGNOSIS_FAILSAFE_MIN_SEC_BETWEEN_CALLS=1
ENV DIAGNOSIS_FAILSAFE_CONSECUTIVE_N=5
ENV DIAGNOSIS_FAILSAFE_MIN_STABLE_SEC=7
ENV DIAGNOSIS_FAILSAFE_COOLDOWN_SEC=300
ENV DIAGNOSIS_FAILSAFE_HEALTHY_SESSION_RATE=0
ENV DIAGNOSIS_FAILSAFE_HEALTHY_MAX_LAST_SESSION_SEC=5

# Doctor Lunar
ENV DOCTOR_REPORT_INTERVAL_MINUTES=2

# Hub connection
ENV LUNAR_HUB_INITIAL_WAIT_TIME_BETWEEN_CONNECTION_ATTEMPTS_SEC=5
ENV LUNAR_HUB_MAX_WAIT_TIME_BETWEEN_CONNECTION_ATTEMPTS_SEC=600
ENV LUNAR_HUB_CONNECTION_ATTEMPTS_PER_WAIT_TIME=5
ENV LUNAR_HUB_CONNECTION_ATTEMPTS_WAIT_TIME_EXPONENTIAL_GROWTH=2

# Redis
ENV REDIS_PREFIX="lunar"
ENV REDIS_MAX_OPTIMISTIC_LOCKING_RETRY_ATTEMPTS=50
ENV REDIS_MAX_RETRY_ATTEMPTS=10
ENV REDIS_RETRY_BACKOFF_MILLIS=50
ENV REDIS_USE_CLUSTER=false

# Redis mTLS
ENV REDIS_USE_CA_CERT=false
ENV REDIS_CA_CERT_PATH="/etc/redis/ca.crt"
ENV REDIS_USE_CLIENT_CERT=false
ENV REDIS_CLIENT_CERT_PATH="/etc/redis/client.crt"
ENV REDIS_CLIENT_KEY_PATH="/etc/redis/client.key"

# Lunar Cluster
ENV LUNAR_CLUSTER_STALE_THRESHOLD_PERIOD_IN_SEC=120
ENV LUNAR_CLUSTER_LIVENESS_UPDATED_PERIOD_IN_SEC=5

# Lunar Resources
ENV LUNAR_CONCURRENT_REQUEST_EXPIRATION_SEC=60

# Lunar Defaults
ENV SHARED_QUEUE_GC_MAX_TIME_BETWEEN_ITERATIONS_MIN=10

ENV HAPROXY_MANAGE_ENDPOINTS_PORT=10252
ENV LUNAR_AGGREGATION_TREE_REFRESH_SECS=300
ENV S6_VERBOSITY=1
ENV S6_KILL_FINISH_MAXTIME=5000
ENV S6_CMD_WAIT_FOR_SERVICES_MAXTIME=0
ENV S6_OVERLAY_DOWNLOAD_LOCATION="https://github.com/just-containers/s6-overlay/releases/download"
ENV DISCOVERY_STATE_LOCATION="/etc/fluent-bit/plugin/discovery-aggregated-state.json"
ENV REMEDY_STATE_LOCATION="/etc/fluent-bit/plugin/remedy-aggregated-state.json"
ENV ENV=dev
ENV LUNAR_UID=lunar
ENV LUNAR_GID=lunar
ENV DD_HOST="http-intake.logs.datadoghq.eu"
ENV METRICS_INTERVAL_SEC=30
ENV METRICS_LISTEN_PORT=3000
ENV DD_API_KEY=${DD_API_KEY}

# --- Base OS Setup and Package Installation (as root) ---
RUN apt-get update && apt-get install -y --no-install-recommends \
    bc=1.07.1-3build1 \
    logrotate=3.19.0-1ubuntu1.1 \
    gnupg=2.2.27-3ubuntu2.3 \
    squid=5.9-0ubuntu0.22.04.2 \
    xz-utils=5.2.5-2ubuntu1 \
    socat=1.7.4.1-3ubuntu4 \
    software-properties-common=0.99.22.9 \
    net-tools=1.60+git20181103.0eebece-1ubuntu5 \
    wget=1.21.2-2ubuntu1 \
    jq=1.6-2.1ubuntu3 \
    ca-certificates \
    # Add haproxy repo and install haproxy 3.0
    && add-apt-repository ppa:vbernat/haproxy-3.0 -y \
    && apt-get update \
    && apt-get install -y --no-install-recommends haproxy=3.0.* \
    # Install yq
    && wget -q -O /usr/local/bin/yq "https://github.com/mikefarah/yq/releases/download/v${JQ_VERSION}/yq_linux_${TARGETARCH}" \
    && chmod a+x /usr/local/bin/yq \
    # Install Fluent Bit
    && wget -q -O - https://packages.fluentbit.io/fluentbit.key | gpg --dearmor > /usr/share/keyrings/fluentbit-keyring.gpg \
    && echo 'deb [signed-by=/usr/share/keyrings/fluentbit-keyring.gpg] https://packages.fluentbit.io/ubuntu/jammy jammy main' >> /etc/apt/sources.list \
    && apt-get update \
    && apt-get -y --no-install-recommends install fluent-bit=2.1.8 \
    # Clean up apt lists
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# --- s6 Overlay Installation (as root) ---
RUN S6ARCH=$([ "$TARGETARCH" = "amd64" ] && echo "x86_64" || echo "aarch64") && \
    wget -q -O /tmp/s6-overlay-noarch.tar.xz "${S6_OVERLAY_DOWNLOAD_LOCATION}/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz" && \
    # Consider pre-downloading checksums or validating differently if needed
    # echo "cee89d3eeabdfe15239b2c5c3581d9352d2197d4fd23bba3f1e64bf916ccf496 /tmp/s6-overlay-noarch.tar.xz" | sha256sum -c - && \
    tar -C / -Jxpf /tmp/s6-overlay-noarch.tar.xz && \
    wget -q -O /tmp/s6-overlay-$TARGETARCH.tar.xz "${S6_OVERLAY_DOWNLOAD_LOCATION}/v${S6_OVERLAY_VERSION}/s6-overlay-${S6ARCH}.tar.xz" && \
    # COPY s6.${TARGETARCH}.sha256 /tmp/s6.${TARGETARCH}.sha256  # Keep if you have checksum files
    # echo "$(cat /tmp/s6.$TARGETARCH.sha256) /tmp/s6-overlay-$TARGETARCH.tar.xz" | sha256sum -c - && \
    tar -Jxpf /tmp/s6-overlay-$TARGETARCH.tar.xz -C / && \
    rm -f /tmp/s6-overlay-*.tar.xz /tmp/s6.*.sha256

# --- Create User and Group (as root) ---
RUN groupadd -r $LUNAR_GID && \
    useradd -r -m -d /home/$LUNAR_UID -s /bin/bash -g $LUNAR_GID $LUNAR_UID

# --- Application Setup and Configuration (as root) ---
# Copy rootfs first as it likely contains base structure/scripts
COPY ./rootfs /

# Copy binaries from build stages
COPY --from=lunar_engine_build /lunar/src/services/lunar-engine/engine /usr/local/sbin/lunar_engine
COPY --from=async_service_build /lunar/src/services/async-service/async-service /usr/local/sbin/async-service
COPY --from=output_aggregation_build /lunar/src/services/aggregation-output-plugin/output_aggregation.so /etc/fluent-bit/plugin/output_aggregation.so

# Copy application specific configs/files
WORKDIR /lunar
COPY ./src/services/lunar-engine/streams/processors/registry/*.yaml ${LUNAR_PROXY_PROCESSORS_DIRECTORY}/
COPY ./metrics.yaml ${LUNAR_PROXY_METRICS_CONFIG_DEFAULT}

# --- Create Directories, Set Permissions (as root) ---
RUN mkdir -p ${LUNAR_PROXY_LOGS_DIR} \
        ${LUNAR_PROXY_FLOW_DIRECTORY} \
        ${LUNAR_PROXY_PROCESSORS_DIRECTORY} \
        ${LUNAR_FLOWS_PATH_PARAM_DIR} \
        ${LUNAR_PROXY_USER_PROCESSORS_DIRECTORY} \
        ${LUNAR_PROXY_QUOTAS_DIRECTORY} \
        ${TLS_CERT_DIRECTORY} \
        ${MTLS_CERT_DIRECTORY} \
        ${LUNAR_PROXY_CONFIG_DIR} \
        ${LUNAR_PROXY_INTERNAL_CONFIG_DIR} \
        ${TIKTOKEN_CACHE_DIR} \
        ${HAPROXY_CONFIG_DIR}/spoe \
        /var/log/squid \
        /etc/squid \
        /var/spool/squid \
        /etc/fluent-bit/plugin \
        /var/run/haproxy \
        /etc/redis \
        /var/lib/logrotate \
    && touch ${LUNAR_PROXY_LOGS_DIR}/haproxy.log \
    && touch ${HAPROXY_CONFIG_DIR}/allowed_domains.lst \
    && touch ${HAPROXY_CONFIG_DIR}/blocked_domains.lst \
    # Ensure fluent bit config templates are processed correctly
    && cp /etc/fluent-bit/topologies/exporters.conf.template /etc/fluent-bit/topologies/exporters.conf \
    && if [ "$DD_API_KEY" != "" ] && [ "$LUNAR_TELEMETRY" == "true" ]; then \
           cp /etc/fluent-bit/topologies/telemetry-datadog.conf /etc/fluent-bit/topologies/telemetry.conf; \
       else \
           cp /etc/fluent-bit/topologies/telemetry-disabled.conf /etc/fluent-bit/topologies/telemetry.conf; \
       fi \
    # Apply permissions
    && chown -R "$LUNAR_UID:$LUNAR_GID" \
        /home/$LUNAR_UID \
        ${LUNAR_PROXY_CONFIG_DIR} \
        ${LUNAR_PROXY_INTERNAL_CONFIG_DIR} \
        ${LUNAR_PROXY_LOGS_DIR} \
        ${TIKTOKEN_CACHE_DIR} \
        ${HAPROXY_CONFIG_DIR} \
        /etc/logrotate.d \
        /var/lib/logrotate \
        /var/log/squid \
        /etc/squid \
        /var/spool/squid \
        /etc/fluent-bit \
        /var/run/haproxy \
        /etc/redis \
    && chmod 644 /etc/logrotate.d/lunar_gateway \
    && chmod +x /usr/local/sbin/lunar_engine \
    && chmod 644 /etc/fluent-bit/plugin/output_aggregation.so \
    && chmod 755 /var/lib/logrotate \
    # Disable squid service startup by default systemd/sysvinit (s6 will manage it if needed)
    && (systemctl list-unit-files | grep -q squid && systemctl disable --now squid || echo "Squid service not managed by systemctl")

EXPOSE ${ENGINE_ADMIN_PORT}
EXPOSE ${BIND_PORT}
EXPOSE ${TLS_PASSTHROUGH_PORT}
EXPOSE ${LUNAR_HEALTHCHECK_PORT}
EXPOSE ${METRICS_LISTEN_PORT}
EXPOSE ${ASYNC_SERVICE_BIND_PORT}

RUN chown $LUNAR_UID:$LUNAR_GID /run -R && chmod 777 /run
# Switch to the non-root user
USER $LUNAR_UID

ENTRYPOINT ["/init"]
