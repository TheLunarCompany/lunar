from typing import Optional
from dataclasses import dataclass, field

from lunar_interceptor.interceptor.hooks.const import VERSION
from lunar_interceptor.interceptor.helpers import load_env_value

ENV_LUNAR_PROXY_HOST_KEY = "LUNAR_PROXY_HOST"
_LUNAR_TENANT_ID = "LUNAR_TENANT_ID"
_ENV_LUNAR_HANDSHAKE_PORT_KEY = "LUNAR_HEALTHCHECK_PORT"
_ENV_PROXY_SUPPORT_TLS_KEY = "LUNAR_PROXY_SUPPORT_TLS"
_ENV_TRAFFIC_FILTER_ALLOW_LIST = "LUNAR_ALLOW_LIST"
_ENV_TRAFFIC_FILTER_BLOCK_LIST = "LUNAR_BLOCK_LIST"
_ENV_FAIL_SAFE_EXIT_COOLDOWN_SEC = "LUNAR_EXIT_COOLDOWN_AFTER_SEC"
_ENV_FAIL_SAFE_ENTER_AFTER = "LUNAR_ENTER_COOLDOWN_AFTER_ATTEMPTS"
_ENV_LUNAR_INTERCEPTOR_LOG_LEVEL = "LUNAR_INTERCEPTOR_LOG_LEVEL"


@dataclass
class TrafficFilterConfig:
    allow_list: Optional[str] = load_env_value(
        _ENV_TRAFFIC_FILTER_ALLOW_LIST, str, None
    )
    block_list: Optional[str] = load_env_value(
        _ENV_TRAFFIC_FILTER_BLOCK_LIST, str, None
    )


@dataclass
class FailSafeConfig:
    cooldown_time: int = load_env_value(_ENV_FAIL_SAFE_ENTER_AFTER, int, 10)
    max_errors: int = load_env_value(_ENV_FAIL_SAFE_EXIT_COOLDOWN_SEC, int, 5)


@dataclass
class ConnectionConfig:
    proxy_host: str = load_env_value(ENV_LUNAR_PROXY_HOST_KEY, str, "")
    tls_supported = load_env_value(_ENV_PROXY_SUPPORT_TLS_KEY, int, 0)
    tenant_id: str = load_env_value(_LUNAR_TENANT_ID, str, "unknown")
    handshake_port: str = load_env_value(_ENV_LUNAR_HANDSHAKE_PORT_KEY, str, "8040")


@dataclass
class InterceptorConfig:
    version: str = VERSION
    connection_config: ConnectionConfig = field(default_factory=ConnectionConfig)
    traffic_filter: TrafficFilterConfig = field(default_factory=TrafficFilterConfig)
    fail_safe_config: FailSafeConfig = field(default_factory=FailSafeConfig)
    log_level: str = load_env_value(_ENV_LUNAR_INTERCEPTOR_LOG_LEVEL, str, "INFO")
