FROM golang:1.20 as lunar_engine_build

WORKDIR /lunar
COPY ./src/libs ./src/libs
COPY ./src/services/lunar-engine ./src/services/lunar-engine
WORKDIR /lunar/src/services/lunar-engine
RUN go clean && go build .

FROM golang:1.20 as output_aggregation_build

WORKDIR /lunar
COPY ./src/libs ./src/libs
COPY ./src/services/aggregation-output-plugin ./src/services/aggregation-output-plugin

WORKDIR /lunar/src/services/aggregation-output-plugin
RUN go build -buildmode=c-shared -o output_aggregation.so .


FROM ubuntu:22.04

LABEL maintainer = "Lunar <support@lunar.dev>"

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ARG LUNAR_VERSION
ARG S6_OVERLAY_VERSION=3.1.2.1
ARG JQ_VERSION=4.34.1
ARG TARGETARCH
ARG AWS_ACCESS_KEY_ID
ARG AWS_SECRET_ACCESS_KEY
ARG LUNAR_REDIRECTION_BY_QUERY_PARAMS
ARG LUNAR_FLUSH_SECONDS
ARG DD_API_KEY

ENV LUNAR_VERSION ${LUNAR_VERSION}
ENV LUNAR_MANAGED false
ENV LOG_LEVEL ERROR
ENV LUNAR_TELEMETRY true
ENV LUNAR_TELEMETRY_SERVER_PORT 55142
ENV LUNAR_TELEMETRY_LOG_LEVEL info
ENV AWS_ACCESS_KEY_ID ${AWS_ACCESS_KEY_ID}
ENV AWS_SECRET_ACCESS_KEY ${AWS_SECRET_ACCESS_KEY}
ENV LUNAR_FLUSH_SECONDS 5
ENV LUNAR_EXPORTER_S3_KEY_FORMAT "/"
ENV LUNAR_EXPORTER_S3_MINIO_KEY_FORMAT "/"
ENV LUNAR_PROXY_CONFIG_DIR="/etc/lunar-proxy"
ENV LUNAR_PROXY_LOGS_DIR="/var/log/lunar-proxy"
ENV HAPROXY_CONFIG_DIR="/etc/haproxy"
ENV LUNAR_SPOE_CONFIG "${HAPROXY_CONFIG_DIR}/spoe/lunar.conf"
ENV SSL_CERT_PATH "${HAPROXY_CONFIG_DIR}/certs/haproxy_cert.pem"
ENV LUNAR_HAPROXY_CONFIG "${HAPROXY_CONFIG_DIR}/haproxy.cfg"
ENV LUNAR_PROXY_POLICIES_CONFIG "${LUNAR_PROXY_CONFIG_DIR}/policies.yaml"
ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/opt/fluent-bit/bin
ENV BIND_PORT 8000
ENV ENGINE_ADMIN_PORT 8081
ENV LUNAR_HEALTHCHECK_PORT 8040

# Proxy timeouts
ENV LUNAR_CONNECT_TIMEOUT_SEC 15
ENV LUNAR_CLIENT_TIMEOUT_SEC 15
ENV LUNAR_SERVER_TIMEOUT_SEC 15

# SPOE timeouts
ENV LUNAR_SPOE_HELLO_TIMEOUT_MS 100
ENV LUNAR_SPOE_IDLE_TIMEOUT_SEC 30
ENV LUNAR_SPOE_PROCESSING_TIMEOUT_SEC 30

ENV HAPROXY_MANAGE_ENDPOINTS_PORT 10252
ENV LUNAR_AGGREGATION_TREE_REFRESH_SECS 300
ENV S6_VERBOSITY 1
ENV S6_KILL_FINISH_MAXTIME 5000
ENV S6_CMD_WAIT_FOR_SERVICES_MAXTIME 0 
ENV S6_OVERLAY_DOWNLOAD_LOCATION="https://github.com/just-containers/s6-overlay/releases/download"
ENV ENV dev
ENV LUNAR_UID lunar
ENV LUNAR_GID lunar
ENV DD_HOST "http-intake.logs.datadoghq.eu"
ENV METRICS_INTERVAL_SEC 30
ENV DD_API_KEY ${DD_API_KEY}

RUN apt-get update && apt-get install -y --no-install-recommends \
    gnupg=2.2.27-3ubuntu2.1 \
    xz-utils=5.2.5-2ubuntu1 \
    software-properties-common=0.99.22.7 \
    net-tools=1.60+git20181103.0eebece-1ubuntu5 \
    wget=1.21.2-2ubuntu1 \
    jq=1.6-2.1ubuntu3 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update && add-apt-repository ppa:vbernat/haproxy-2.8 -y \
    && apt-get install -y --no-install-recommends haproxy=2.8.4-1ppa1~jammy \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN wget -q -O /usr/local/bin/yq "https://github.com/mikefarah/yq/releases/download/v${JQ_VERSION}/yq_linux_${TARGETARCH}" \
    && chmod a+x /usr/local/bin/yq

# Get s6-overlay
# To calculate S6_SHA256SUM for a specific version, run:
# curl -L ${S6_OVERLAY_DOWNLOAD_LOCATION}/v${S6_OVERLAY_VERSION}/s6-overlay-<arch>.tar.xz | sha256sum

ADD ${S6_OVERLAY_DOWNLOAD_LOCATION}/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz /tmp
RUN echo "cee89d3eeabdfe15239b2c5c3581d9352d2197d4fd23bba3f1e64bf916ccf496 /tmp/s6-overlay-noarch.tar.xz" | sha256sum -c - && rm -f /tmp/s6.noarch.sha256
RUN tar -C / -Jxpf /tmp/s6-overlay-noarch.tar.xz

RUN S6ARCH=$([ "$TARGETARCH" = "amd64" ] && echo "x86_64" || echo "aarch64") && wget -q -O /tmp/s6-overlay-$TARGETARCH.tar.xz "${S6_OVERLAY_DOWNLOAD_LOCATION}/v${S6_OVERLAY_VERSION}/s6-overlay-${S6ARCH}.tar.xz"
COPY s6.${TARGETARCH}.sha256 /tmp/s6.${TARGETARCH}.sha256
RUN echo "$(cat /tmp/s6.$TARGETARCH.sha256) /tmp/s6-overlay-$TARGETARCH.tar.xz" | sha256sum -c - && rm -f /tmp/s6.$TARGETARCH.sha256

RUN tar -Jxpf /tmp/s6-overlay-$TARGETARCH.tar.xz -C /

RUN wget -q -O - https://packages.fluentbit.io/fluentbit.key | gpg --dearmor > /usr/share/keyrings/fluentbit-keyring.gpg
RUN echo 'deb [signed-by=/usr/share/keyrings/fluentbit-keyring.gpg] https://packages.fluentbit.io/ubuntu/jammy jammy main' >> /etc/apt/sources.list

RUN apt-get update && apt-get -y --no-install-recommends install fluent-bit=2.1.8 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN rm -fr ./etc/haproxy
COPY ./rootfs /
RUN cp /etc/fluent-bit/topologies/exporters.conf.template /etc/fluent-bit/topologies/exporters.conf

RUN if [ "$DD_API_KEY" != "" ] && [ "$LUNAR_TELEMETRY" == "true" ]; then \
        cp /etc/fluent-bit/topologies/telemetry-datadog.conf /etc/fluent-bit/topologies/telemetry.conf; \
    else \
        cp /etc/fluent-bit/topologies/telemetry-disabled.conf /etc/fluent-bit/topologies/telemetry.conf; \
    fi

# prepare a directory for HAProxy log files to be saved to
RUN mkdir -p ${LUNAR_PROXY_LOGS_DIR} && touch ${LUNAR_PROXY_LOGS_DIR}/haproxy.log

COPY --from=lunar_engine_build /lunar/src/services/lunar-engine/engine /usr/local/sbin/lunar_engine
COPY --from=output_aggregation_build /lunar/src/services/aggregation-output-plugin/output_aggregation.so /etc/fluent-bit/plugin/output_aggregation.so

EXPOSE ${ENGINE_ADMIN_PORT}
EXPOSE ${BIND_PORT}

RUN useradd -r "${LUNAR_UID}" && \
    mkdir -p /var/run/haproxy && \
    chown -R "$LUNAR_UID:$LUNAR_GID" /var/run/haproxy && \
    chown -R "$LUNAR_UID:$LUNAR_GID" /etc/fluent-bit && \
    chown -R "$LUNAR_UID:$LUNAR_GID" ${LUNAR_PROXY_LOGS_DIR} && \
    chown -R "$LUNAR_UID:$LUNAR_GID" ${LUNAR_PROXY_CONFIG_DIR}

USER lunar

ENTRYPOINT ["/init"]
