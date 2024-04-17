from logging import Logger
from typing import Optional, List
from dataclasses import dataclass, field

from lunar_interceptor.interceptor.hooks.const import VERSION, HTTPS_SCHEME, HTTP_SCHEME
from lunar_interceptor.interceptor.helpers import load_env_value

ENV_LUNAR_PROXY_HOST_KEY = "LUNAR_PROXY_HOST"
_LUNAR_TENANT_ID = "LUNAR_TENANT_ID"
_ENV_LUNAR_HANDSHAKE_PORT_KEY = "LUNAR_HANDSHAKE_PORT"
_ENV_PROXY_SUPPORT_TLS_KEY = "LUNAR_PROXY_SUPPORT_TLS"
_ENV_TRAFFIC_FILTER_ALLOW_LIST = "LUNAR_ALLOW_LIST"
_ENV_TRAFFIC_FILTER_BLOCK_LIST = "LUNAR_BLOCK_LIST"
_ENV_FAIL_SAFE_EXIT_COOLDOWN_SEC = "LUNAR_EXIT_COOLDOWN_AFTER_SEC"
_ENV_FAIL_SAFE_ENTER_AFTER = "LUNAR_ENTER_COOLDOWN_AFTER_ATTEMPTS"


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
    is_valid: bool
    proxy_host: str
    proxy_port: int
    proxy_scheme: str
    proxy_url: str
    proxy_host_with_port: str
    tenant_id: str = load_env_value(_LUNAR_TENANT_ID, str, "unknown")
    handshake_port: str = load_env_value(_ENV_LUNAR_HANDSHAKE_PORT_KEY, str, "8081")


@dataclass
class InterceptorConfig:
    connection_config: ConnectionConfig
    version: str = VERSION
    traffic_filter: TrafficFilterConfig = field(default_factory=TrafficFilterConfig)
    fail_safe_config: FailSafeConfig = field(default_factory=FailSafeConfig)


def get_connection_config(logger: Logger) -> ConnectionConfig:
    proxy_host_value: str = load_env_value(ENV_LUNAR_PROXY_HOST_KEY, str, "null")
    proxy_scheme: str = (
        HTTPS_SCHEME
        if load_env_value(_ENV_PROXY_SUPPORT_TLS_KEY, int, 0)
        else HTTP_SCHEME
    )
    if proxy_host_value == "null":
        return ConnectionConfig(
            is_valid=False,
            proxy_host="",
            proxy_port=0,
            proxy_scheme=proxy_scheme,
            proxy_url="",
            proxy_host_with_port="",
        )

    proxy_host_and_port: List[str] = proxy_host_value.split(":")
    if len(proxy_host_and_port) == 0:
        logger.warning(
            "Could not obtain the Host value of Lunar Proxy from environment variables,"
            f"please set {ENV_LUNAR_PROXY_HOST_KEY} to the Lunar Proxy's host/IP and port in."
            f"current value: {proxy_host_value}"
        )
        return ConnectionConfig(
            is_valid=False,
            proxy_host="",
            proxy_port=0,
            proxy_scheme=proxy_scheme,
            proxy_url="",
            proxy_host_with_port="",
        )

    if len(proxy_host_and_port) == 1:
        logger.warning(
            "Could not obtain the Port value of Lunar Proxy from environment variables,"
            f"please set {ENV_LUNAR_PROXY_HOST_KEY} to the Lunar Proxy's host/IP and port in order to allow the interceptor to be loaded."
            f"current value: {proxy_host_value}"
        )
        return ConnectionConfig(
            is_valid=False,
            proxy_host="",
            proxy_port=0,
            proxy_scheme=proxy_scheme,
            proxy_url="",
            proxy_host_with_port="",
        )

    if len(proxy_host_and_port) > 2:
        logger.warning(
            "Could not parse the Host value of Lunar Proxy from environment variables,"
            f"please set {ENV_LUNAR_PROXY_HOST_KEY} to the Lunar Proxy's host/IP and port in with the format of 'host:port'."
            "Please note that the value should not contain any additional ':' such as Protocol in order to allow the interceptor to be loaded."
            f"current value: {proxy_host_value}"
        )
        return ConnectionConfig(
            is_valid=False,
            proxy_host="",
            proxy_port=0,
            proxy_scheme=proxy_scheme,
            proxy_url="",
            proxy_host_with_port="",
        )

    proxy_host: str = proxy_host_and_port[0]
    try:
        proxy_port: int = int(proxy_host_and_port[1])
    except ValueError:
        logger.warning(
            "Could not parse the Port value of Lunar Proxy from environment variables,"
            f"please set {ENV_LUNAR_PROXY_HOST_KEY} to the Lunar Proxy's host/IP and port in order to allow the interceptor to be loaded."
            f"current value: {proxy_host_value}"
        )
        return ConnectionConfig(
            is_valid=False,
            proxy_host="",
            proxy_port=0,
            proxy_scheme=proxy_scheme,
            proxy_url="",
            proxy_host_with_port="",
        )

    proxy_url = f"{proxy_scheme}://{proxy_host}:{proxy_port}"
    proxy_host_with_port = f"{proxy_host}:{proxy_port}"
    return ConnectionConfig(
        is_valid=True,
        proxy_host=proxy_host,
        proxy_port=proxy_port,
        proxy_scheme=proxy_scheme,
        proxy_url=proxy_url,
        proxy_host_with_port=proxy_host_with_port,
    )


def get_interceptor_config(logger: Logger) -> InterceptorConfig:
    proxy_connection_info: ConnectionConfig = get_connection_config(logger)
    return InterceptorConfig(proxy_connection_info)
