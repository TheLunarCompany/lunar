import logging

from lunar_interceptor.interceptor import Interceptor
from lunar_interceptor.interceptor.helpers import load_env_value
from lunar_interceptor.interceptor.traffic_filter import TrafficFilter
from lunar_interceptor.interceptor.fail_safe import (
    FailSafe,
    ProxyErrorException,
)
from aiohttp.client_exceptions import (
    ClientConnectionError,
    ClientConnectorError,
    ClientSSLError,
)

_ENV_LUNAR_PROXY_HOST_KEY = "LUNAR_PROXY_HOST"
_LUNAR_TENANT_ID = "LUNAR_TENANT_ID"
_ENV_LUNAR_HANDSHAKE_PORT_KEY = "LUNAR_HEALTHCHECK_PORT"
_ENV_PROXY_SUPPORT_TLS_KEY = "LUNAR_PROXY_SUPPORT_TLS"
_ENV_TRAFFIC_FILTER_ALLOW_LIST = "LUNAR_ALLOW_LIST"
_ENV_TRAFFIC_FILTER_BLOCK_LIST = "LUNAR_BLOCK_LIST"
_ENV_FAIL_SAFE_EXIT_COOLDOWN_SEC = "LUNAR_EXIT_COOLDOWN_AFTER_SEC"
_ENV_FAIL_SAFE_ENTER_AFTER = "LUNAR_ENTER_COOLDOWN_AFTER_ATTEMPTS"
_ENV_LUNAR_INTERCEPTOR_LOG_LEVEL = "LUNAR_INTERCEPTOR_LOG_LEVEL"

_INTERCEPTOR_NAME = "lunar-interceptor"


def _initialize_lunar_logger() -> logging.Logger:
    log_format = logging.Formatter(
        f"%(asctime)s - {_INTERCEPTOR_NAME} - %(levelname)s: %(message)s"
    )
    log_level = load_env_value(_ENV_LUNAR_INTERCEPTOR_LOG_LEVEL, str, "INFO")

    logger = logging.getLogger(name=_INTERCEPTOR_NAME)
    logger.setLevel(log_level)

    stream_handler = logging.StreamHandler()
    stream_handler.setLevel(log_level)
    stream_handler.setFormatter(log_format)
    logger.addHandler(stream_handler)

    return logger


_LOGGER = _initialize_lunar_logger()


def _proxy_is_tls_supported() -> bool:
    proxy_tls_supported = load_env_value(_ENV_PROXY_SUPPORT_TLS_KEY, int, 0)
    if proxy_tls_supported == 0:
        return False

    elif proxy_tls_supported == 1:
        return True

    else:
        _LOGGER.warning(
            f"Environment variable {_ENV_PROXY_SUPPORT_TLS_KEY}"
            "should be 0 or 1 , setting default to 0."
        )
        return False


def _get_proxy_host() -> str:
    proxy_host = load_env_value(_ENV_LUNAR_PROXY_HOST_KEY, str, "")

    if not proxy_host:
        _LOGGER.warning(
            f"Could not obtain the Host value of Lunar Proxy from environment variables,"
            "please set {_ENV_LUNAR_PROXY_HOST_KEY} to the Lunar Proxy's host/IP and port in"
            "order to allow the interceptor to be loaded."
        )

    return proxy_host


def _load_fail_safe() -> FailSafe:
    cooldown_time = load_env_value(_ENV_FAIL_SAFE_ENTER_AFTER, int, None)
    max_errors = load_env_value(_ENV_FAIL_SAFE_EXIT_COOLDOWN_SEC, int, None)

    fail_safe = FailSafe(
        cooldown_time=cooldown_time,
        max_errors_allowed=max_errors,
        logger=_LOGGER,
        handle_on=(
            ClientConnectionError,
            ClientConnectorError,
            ProxyErrorException,
            ClientSSLError,
        ),
    )

    return fail_safe


def _build_traffic_filter_from_env_vars() -> TrafficFilter:
    raw_allow_list = load_env_value(_ENV_TRAFFIC_FILTER_ALLOW_LIST, str, None)
    raw_block_list = load_env_value(_ENV_TRAFFIC_FILTER_BLOCK_LIST, str, None)
    return TrafficFilter(raw_block_list, raw_allow_list, _LOGGER)


def _initialize_hooks(proxy_host: str):
    lunar_interceptor = Interceptor(
        lunar_proxy_host=proxy_host,
        lunar_tenant_id=load_env_value(_LUNAR_TENANT_ID, str, "unknown"),
        lunar_handshake_port=load_env_value(_ENV_LUNAR_HANDSHAKE_PORT_KEY, str, "8040"),
        proxy_support_tls=_proxy_is_tls_supported(),
        fail_safe=_load_fail_safe(),
        traffic_filter=_build_traffic_filter_from_env_vars(),
        logger=_LOGGER,
    )
    lunar_interceptor.set_hooks()
    _LOGGER.debug(f"Lunar Interceptor is ENABLED!")


_proxy_host = _get_proxy_host()
if _proxy_host:  # Lunar Interceptor can be loaded.
    _initialize_hooks(_proxy_host)

else:  # Lunar Interceptor can׳t be loaded without the Lunar Proxy address.
    _LOGGER.warning(f"Lunar Interceptor is DISABLED!")
