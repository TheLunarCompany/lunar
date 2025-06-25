#!/bin/sh
set -e

echo "[INFO] Detecting OS and installing ca-certificates..."

# Detect package manager and install ca-certificates
if [ -f /etc/os-release ]; then
    . /etc/os-release
    case "$ID" in
        alpine)
            echo "[INFO] Alpine detected"
            cp "/mitmproxy-ca-cert.pem" "/usr/local/share/ca-certificates/proxy_lunar.crt"
            apk add --no-cache ca-certificates
            update-ca-certificates
            ;;
        debian|ubuntu)
            echo "[INFO] Debian/Ubuntu detected"
            cp "/mitmproxy-ca-cert.pem" "/usr/local/share/ca-certificates/proxy_lunar.crt"
            apt-get update && apt-get install -y --no-install-recommends ca-certificates
            update-ca-certificates
            ;;
        centos|rhel|fedora)
            echo "[INFO] RHEL-based system detected"
            cp "/mitmproxy-ca-cert.pem" "/etc/pki/ca-trust/source/anchors/proxy_lunar.crt"
            yum install -y ca-certificates
            update-ca-trust force-enable || true
            update-ca-trust extract || true
            ;;
        *)
            echo "[WARN] Unknown distro: $ID. Attempting common CA update..."
            update-ca-certificates || update-ca-trust extract || true
            ;;
    esac
else
    echo "[ERROR] Cannot detect OS. Proceeding without installing CA certificates."
fi

exec "$@"
