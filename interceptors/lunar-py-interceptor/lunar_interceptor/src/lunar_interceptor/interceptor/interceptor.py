import asyncio
import logging
from urllib.parse import urlparse
from typing import Any, List, Dict, Optional

from multidict import CIMultiDictProxy

from lunar_interceptor.interceptor.fail_safe import FailSafe
from lunar_interceptor.interceptor.singleton import Singleton
from lunar_interceptor.interceptor.traffic_filter import TrafficFilter
from lunar_interceptor.interceptor.helpers import get_package_version

import aiohttp
from yarl import URL
from aiohttp.typedefs import StrOrURL
from aiohttp.client import ClientResponse

# fmt: off
_ORIGINAL_AIOHTTP_SESSION_REQUEST = aiohttp.client.ClientSession._request  # type: ignore [reportPrivateUsage, reportUnknownMemberType]
# fmt: on

_HTTP_SCHEME = "http"
_HTTPS_SCHEME = "https"
_HOST_HEADER_KEY = "Host"
_X_LUNAR_SCHEME_HEADER_KEY = "x-lunar-scheme"
_X_LUNAR_INTERCEPTOR_HEADER_KEY = "x-lunar-interceptor"
_X_LUNAR_TENANT_ID_HEADER_KEY = "x-lunar-tenant-id"
_INTERCEPTOR_TYPE_VALUE = "lunar-py-interceptor"
_VERSION = get_package_version("lunar-interceptor")  # type: ignore [reportUnknownVariableType]
_INTERCEPTOR_HEADER_DELIMITER = "/"
_LUNAR_INTERCEPTOR_HEADER_VALUE = (
    f"{_INTERCEPTOR_TYPE_VALUE}{_INTERCEPTOR_HEADER_DELIMITER}{_VERSION}"
)

_HEADERS_KWARGS_KEY = "headers"
_CACHE_HEADERS_KEY = "headers"
_LUNAR_SEQ_ID_HEADER_KEY = "x-lunar-sequence-id"
_LUNAR_RETRY_AFTER_HEADER_KEY = "x-lunar-retry-after"


class Interceptor(metaclass=Singleton):
    """
    This is the logic that allow the framework (AioHttp) to forward the HTTP/S requests through Lunar Proxy.

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
        lunar_proxy_host: str,
        lunar_tenant_id: str,
        lunar_handshake_port: str,
        proxy_support_tls: bool,
        fail_safe: FailSafe,
        traffic_filter: TrafficFilter,
        logger: logging.Logger,
    ):
        self._lunar_proxy: str = lunar_proxy_host
        self._lunar_tenant_id: str = lunar_tenant_id
        self._lunar_proxy_handshake_port: str = lunar_handshake_port
        self._proxy_support_tls = proxy_support_tls
        self._traffic_filter = traffic_filter
        self._fail_safe = fail_safe
        self._logger = logger
        asyncio.get_event_loop().run_until_complete(
            self._validate_lunar_proxy_connection()
        )

    def set_hooks(self) -> None:
        """
        Initialize the required hooks to the AioHttp framework in order to allow traffic to be forwarded through Lunar Proxy.
        """

        # fmt: off
        aiohttp.client.ClientSession._request = self._hook_session_request()  # type: ignore [reportPrivateUsage, reportUnknownMemberType]
        # fmt: on
        self._logger.debug("Aiohttp Interceptor is loaded...")

    def _hook_session_request(self):
        """
        This function will wrap the AioHttp request function and attempt to pass it through Lunar Proxy.
        This wrapper will be called each time AioHttp׳s request method is called.

        Note:
            In case of an error while using Lunar Proxy, the request will be reverted and go directly to the original destination (Without going through Lunar Proxy).
        """

        async def _request(
            client_session: "aiohttp.ClientSession",
            method: str,
            url: StrOrURL,
            *args: List[Any],
            **kwargs: Dict[str, Any],
        ) -> ClientResponse:
            url_object = client_session._build_url(url)  # type: ignore [reportPrivateUsage]
            original_headers = kwargs.pop(_HEADERS_KWARGS_KEY, {})

            with self._fail_safe:
                if self._fail_safe.state_ok and self._traffic_filter.is_allowed(
                    str(url_object.host)
                ):
                    return await self._make_proxified_request(
                        client_session=client_session,
                        method=method,
                        url_object=url_object,
                        original_headers=original_headers,
                        sequence_id=None,
                        *args,
                        **kwargs,
                    )

            kwargs[_HEADERS_KWARGS_KEY] = original_headers
            return await _ORIGINAL_AIOHTTP_SESSION_REQUEST(
                client_session, method, url, *args, **kwargs
            )

        return _request

    async def _make_proxified_request(
        self,
        client_session: "aiohttp.ClientSession",
        method: str,
        url_object: URL,
        original_headers: Dict[str, Any],
        sequence_id: Optional[str] = None,
        *args: List[Any],
        **kwargs: Dict[str, Any],
    ) -> ClientResponse:
        manipulated_headers = self._generate_modified_headers(
            original_url=url_object,
            original_headers=original_headers,
            sequence_id=sequence_id,
        )

        response = await _ORIGINAL_AIOHTTP_SESSION_REQUEST(
            self=client_session,
            method=method,
            str_or_url=self._generate_modified_url(url_object),
            headers=manipulated_headers,
            *args,
            **kwargs,
        )

        self._fail_safe.validate_headers(response.headers)

        retry_sequence_id = await self._prepare_for_retry(response.headers)
        if retry_sequence_id is not None:
            response = await self._make_proxified_request(
                client_session=client_session,
                method=method,
                url_object=url_object,
                original_headers=original_headers,
                sequence_id=retry_sequence_id,
                *args,
                **kwargs,
            )

        modified_response_headers = self._generate_modified_response_headers(
            response.headers
        )
        response._cache[_CACHE_HEADERS_KEY] = modified_response_headers  # type: ignore [reportPrivateUsage]

        return response

    async def _prepare_for_retry(self, headers: CIMultiDictProxy[str]) -> Optional[str]:
        raw_retry_after = headers.get(_LUNAR_RETRY_AFTER_HEADER_KEY)
        if raw_retry_after is None:
            return None

        sequence_id = headers.get(_LUNAR_SEQ_ID_HEADER_KEY)
        if sequence_id is None:
            self._logger.debug(
                f"Retry required, but {_LUNAR_SEQ_ID_HEADER_KEY} is missing!"
            )
            return None

        try:
            retry_after = float(raw_retry_after)
        except ValueError:
            self._logger.debug(
                f"Retry required, but parsing header {_LUNAR_RETRY_AFTER_HEADER_KEY}"
                + f"as float failed ({raw_retry_after})"
            )
            return None

        self._logger.debug(f"Retry required, will retry in {retry_after} seconds...")
        await asyncio.sleep(retry_after)
        return sequence_id

    def _generate_modified_headers(
        self,
        original_url: URL,
        original_headers: Optional[Dict[str, str]],
        sequence_id: Optional[str],
    ) -> Dict[str, str]:
        """
        Generate the headers to support the proxy work flow.

        Args:
            original_url (yarl.URL):The url object converted by the original url passed to the request.
            original_headers (Dict[str ,str]): The dictionary of the original request headers.

        Returns:
            Dict[str, str]: A modified dictionary of headers.
        """
        if original_url.host is None:
            raise Exception("Could not parse the hostname, reverting to original flow.")

        destination_port = original_url.port

        host = (
            f"{original_url.host}:{destination_port}"
            if destination_port is not None
            else original_url.host
        )

        modified_headers: Dict[str, str] = (
            original_headers.copy() if original_headers else {}
        )
        modified_headers[_HOST_HEADER_KEY] = host
        modified_headers[_X_LUNAR_SCHEME_HEADER_KEY] = original_url.scheme
        modified_headers[
            _X_LUNAR_INTERCEPTOR_HEADER_KEY
        ] = _LUNAR_INTERCEPTOR_HEADER_VALUE
        if self._traffic_filter.managed:
            modified_headers[_X_LUNAR_TENANT_ID_HEADER_KEY] = self._lunar_tenant_id

        if sequence_id is not None:
            modified_headers[_LUNAR_SEQ_ID_HEADER_KEY] = sequence_id

        return modified_headers

    def _generate_modified_response_headers(
        self, original_headers: CIMultiDictProxy[str]
    ) -> CIMultiDictProxy[str]:
        if _LUNAR_SEQ_ID_HEADER_KEY not in original_headers:
            return original_headers

        manipulated_headers = original_headers.copy()
        manipulated_headers.pop(_LUNAR_SEQ_ID_HEADER_KEY)
        return CIMultiDictProxy(manipulated_headers)

    def _generate_modified_url(self, original_url: URL) -> URL:
        """
        Generate the required url to connect through the proxy instead of the original host.

        Args:
            original_url (yarl.URL): The url object converted by the original url passed to the request.

        Returns:
            URL: An url object that point to Lunar proxy.
        """
        return original_url.with_scheme(self._get_scheme(original_url)).with_host(
            self._lunar_proxy
        )

    def _get_scheme(self, url: StrOrURL) -> str:
        """
        Check the scheme of the original url in order to determine whether a connection should be initiated via TLS or not.

        Args:
            url (aiohttp.typedefs.StrOrURL): The original url the client want to call.

        Returns:
            str: the scheme of the connection.
        """

        if not self._proxy_support_tls:
            return _HTTP_SCHEME

        if isinstance(url, str):
            url_scheme = urlparse(url).scheme
            return url_scheme if url_scheme else _HTTPS_SCHEME

        return url.scheme

    async def _validate_lunar_proxy_connection(self) -> None:
        """
        Checks the communication to Lunar Proxy.
        """
        proxy_scheme = _HTTPS_SCHEME if self._proxy_support_tls else _HTTP_SCHEME
        proxy_handshake_host = (
            f"{self._lunar_proxy.split(':')[0]}:{self._lunar_proxy_handshake_port}"
        )
        self._logger.debug("Establishing handshake with Lunar Proxy...")
        try:
            async with aiohttp.ClientSession() as validate_session:
                headers = {_X_LUNAR_TENANT_ID_HEADER_KEY: self._lunar_tenant_id}
                async with validate_session.get(
                    f"{proxy_scheme}://{proxy_handshake_host}/handshake",
                    headers=headers,
                ) as resp:
                    if resp.status == 200:
                        self._logger.debug(
                            f"[ⓥ] Successfully communicate with Lunar Proxy"
                        )
                        resp_json = await resp.json()
                        self._traffic_filter.managed = resp_json.get("managed", False)
                        return

        except Exception as e:
            self._logger.warning(f"Establishing handshake with Lunar Proxy. Error: {e}")

        self._logger.warning(
            f"[ⓧ] Failed to communicate with Lunar Proxy,"
            f" please make sure that Lunar Proxy is running and port '{self._lunar_proxy_handshake_port}'"
            f" is set as the healthcheck port.\n"
            f" For more information please refer to:"
            f" http://docs.lunar.dev/installation-configuration/configuration#lunar-interceptor-configuration"
        )
