import asyncio
import logging
from typing import List

from lunar_interceptor.interceptor.hooks.const import *
from lunar_interceptor.interceptor.hooks import LUNAR_HOOKS
from lunar_interceptor.interceptor.fail_safe import FailSafe
from lunar_interceptor.interceptor.singleton import Singleton
from lunar_interceptor.interceptor.hooks.hook import LunarHook
from lunar_interceptor.interceptor.traffic_filter import TrafficFilter
from lunar_interceptor.interceptor.configuration import ConnectionConfig


class Interceptor(metaclass=Singleton):
    """
    This is the logic that allow the framework to forward the HTTP/S requests through Lunar Proxy.

    Args:
        lunar_proxy_host (str): The Lunar Proxy IP and port string, this allows the interceptor to correctly forward the requests through the relevant Proxy.
        lunar_handshake_port (str): The Lunar Proxy handshake port as string, this allows the interceptor to validate connection with the Proxy.
        proxy_support_tls (bool): If true, uses HTTPS communication with the proxy when the original request uses HTTPS. If false, all communication with proxy will be made using HTTP.
                                  Regardless of this argument, proxy will use the original scheme when connecting to external APIs.
        fail_safe (FailSafe): The FailSafe module.
        traffic_filter (TrafficFilter): The TrafficFilter module.
        logger (logging.Logger): Logger.
    """

    def __init__(
        self,
        lunar_proxy_configuration: ConnectionConfig,
        fail_safe: FailSafe,
        traffic_filter: TrafficFilter,
        logger: logging.Logger,
    ):
        self._connection_config = lunar_proxy_configuration
        self._traffic_filter = traffic_filter
        self._fail_safe = fail_safe
        self._logger = logger
        self._lunar_hooks: List[LunarHook] = []

    def set_hooks(self) -> None:
        """
        Initialize the required hooks to the AioHttp framework in order to allow traffic to be forwarded through Lunar Proxy.
        """
        for module in LUNAR_HOOKS:
            if module.is_hook_supported():
                self._lunar_hooks.append(
                    module(
                        lunar_proxy_configuration=self._connection_config,
                        logger=self._logger,
                        fail_safe=self._fail_safe,
                        traffic_filter=self._traffic_filter,
                    )
                )

        self._logger.debug("Python Interceptor is loaded...")

        asyncio.get_event_loop().run_until_complete(
            self._validate_lunar_proxy_connection()
        )

    async def _validate_lunar_proxy_connection(self) -> None:
        """
        Checks the communication to Lunar Proxy.
        """

        headers = {X_LUNAR_TENANT_ID_HEADER_KEY: self._connection_config.tenant_id}
        proxy_handshake_host = f"{self._connection_config.proxy_scheme}://{self._connection_config.proxy_host}:{self._connection_config.handshake_port}/handshake"

        if not self._lunar_hooks:
            return

        self._logger.debug("Establishing handshake with Lunar Proxy...")

        res = await self._lunar_hooks[0].make_connection(
            url=proxy_handshake_host, headers=headers
        )

        if not res:
            self._logger.warning(
                f"[ⓧ] Failed to communicate with Lunar Proxy.\n"
                f" Lunar Interceptor is disabled.\n"
                f" please make sure that Lunar Proxy is running and port '{self._connection_config.handshake_port}'"
                f" is set as the handshake port.\n"
                f" For more information please refer to:"
                f" http://docs.lunar.dev/installation-configuration/configuration#lunar-interceptor-configuration"
            )
            return

        for hook in self._lunar_hooks:
            hook.init_hooks()

        self._logger.info(
            "[ⓥ] Successfully communicate with Lunar Proxy"
            "Lunar Interceptor is ENABLED!"
        )
