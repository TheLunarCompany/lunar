FROM golang:1.20 AS builder

WORKDIR /app

# Copy workspace dependencies
COPY ./ctl ./ctl
COPY ./proxy/src/ ./proxy/src/
COPY ./sandbox/src/provider ./sandbox/src/provider

# Copy Go workspace files
COPY ./go.work ./go.work.sum ./

COPY ./proxy/src/services/flows-validator ./proxy/src/services/flows-validator

WORKDIR /app/proxy/src/services/flows-validator

RUN CGO_ENABLED=0 GOOS=linux go build -o flows-validator

# Runtime stage
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

ENV LUNAR_SPOE_PROCESSING_TIMEOUT_SEC=61 \
    LUNAR_PROXY_PROCESSORS_DIRECTORY=/etc/lunar-proxy-internal/processors \
    LUNAR_VALIDATOR_PORT=8083 \
    PATH="/usr/local/bin:$PATH"

RUN mkdir -p ${LUNAR_PROXY_PROCESSORS_DIRECTORY} && \
    chmod -R 755 /etc/lunar-proxy-internal

# Copy the built binary from the builder stage
COPY --from=builder /app/proxy/src/services/flows-validator/flows-validator /usr/local/bin/flows-validator

# Copy processor files
COPY ./proxy/src/services/lunar-engine/streams/processors/registry/*.yaml ${LUNAR_PROXY_PROCESSORS_DIRECTORY}/

EXPOSE ${LUNAR_VALIDATOR_PORT}

CMD ["flows-validator"]