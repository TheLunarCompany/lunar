import logging
import platform

from lunar_interceptor.interceptor import (
    Interceptor,
    InterceptorConfig,
    ENV_LUNAR_PROXY_HOST_KEY,
)
from lunar_interceptor.interceptor.traffic_filter import TrafficFilter
from lunar_interceptor.interceptor.fail_safe import (
    FailSafe,
    ProxyErrorException,
)

_INTERCEPTOR_NAME = "lunar-interceptor"
interceptor_config = InterceptorConfig()


def _initialize_lunar_logger() -> logging.Logger:
    log_format = logging.Formatter(
        f"%(asctime)s - {_INTERCEPTOR_NAME} - %(levelname)s: %(message)s"
    )
    log_level = interceptor_config.log_level

    logger = logging.getLogger(name=_INTERCEPTOR_NAME)
    logger.setLevel(log_level)

    stream_handler = logging.StreamHandler()
    stream_handler.setLevel(log_level)
    stream_handler.setFormatter(log_format)
    logger.addHandler(stream_handler)

    return logger


_LOGGER = _initialize_lunar_logger()


def _load_fail_safe() -> FailSafe:
    fail_safe = FailSafe(
        cooldown_time=interceptor_config.fail_safe_config.cooldown_time,
        max_errors_allowed=interceptor_config.fail_safe_config.max_errors,
        logger=_LOGGER,
        handle_on=(ProxyErrorException,),
    )

    return fail_safe


def _build_traffic_filter_from_env_vars() -> TrafficFilter:
    return TrafficFilter(
        interceptor_config.traffic_filter.block_list,
        interceptor_config.traffic_filter.allow_list,
        _LOGGER,
    )


def _initialize_hooks():
    lunar_interceptor = Interceptor(
        lunar_proxy_host=interceptor_config.connection_config.proxy_host,
        lunar_tenant_id=interceptor_config.connection_config.tenant_id,
        lunar_handshake_port=interceptor_config.connection_config.handshake_port,
        proxy_support_tls=interceptor_config.connection_config.tls_supported == 1,
        fail_safe=_load_fail_safe(),
        traffic_filter=_build_traffic_filter_from_env_vars(),
        logger=_LOGGER,
    )
    lunar_interceptor.set_hooks()
    _LOGGER.debug(f"Lunar Interceptor is ENABLED!")


if _LOGGER.isEnabledFor(logging.DEBUG):
    _LOGGER.debug(
        "Lunar Interceptor has loaded in debug mode."
        "The current configuration are"
        f"  * Interceptor Version: {interceptor_config.version}"
        f"  * Lunar Proxy Host: {interceptor_config.connection_config.proxy_host}"
        f"  * Lunar Proxy Handshake Port: {interceptor_config.connection_config.handshake_port}"
        ""
        "Environment details:"
        f"  * Python Engine Version: {platform.python_version()}"
    )

if (
    interceptor_config.connection_config.proxy_host != ""
):  # Lunar Interceptor can be loaded.
    _initialize_hooks()

else:  # Lunar Interceptor can׳t be loaded without the Lunar Proxy address.
    _LOGGER.warning(
        "Could not obtain the Host value of Lunar Proxy from environment variables,"
        f"please set {ENV_LUNAR_PROXY_HOST_KEY} to the Lunar Proxy's host/IP and port in"
        "order to allow the interceptor to be loaded."
        "Lunar Interceptor is DISABLED!"
    )
