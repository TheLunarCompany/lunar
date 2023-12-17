import logging
from yarl import URL
from asyncio import sleep
from multidict import CIMultiDictProxy
from typing import Any, List, Dict, Optional

from lunar_interceptor.interceptor.hooks.const import *
from lunar_interceptor.interceptor.hooks.helpers import *
from lunar_interceptor.interceptor.fail_safe import FailSafe
from lunar_interceptor.interceptor.hooks.hook import LunarHook
from lunar_interceptor.interceptor.traffic_filter import TrafficFilter

_hook = True

try:
    import aiohttp
    from aiohttp.typedefs import StrOrURL
    from aiohttp.client_exceptions import (
        ClientConnectionError,
        ClientConnectorError,
        ClientSSLError,
    )
except ImportError:
    _hook = False


class AioHttpHook(LunarHook):
    def __init__(
        self,
        scheme: str,
        lunar_proxy: str,
        lunar_tenant_id: str,
        logger: logging.Logger,
        fail_safe: FailSafe,
        traffic_filter: TrafficFilter,
    ) -> None:
        self._scheme = scheme
        self._lunar_tenant_id: str = lunar_tenant_id
        self._lunar_proxy = lunar_proxy
        self._logger = logger
        self._traffic_filter = traffic_filter
        self._fail_safe = fail_safe
        self._original_function = aiohttp.client.ClientSession._request  # type: ignore [reportPrivateUsage, reportUnknownMemberType]

        # fmt: off
        aiohttp.client.ClientSession._request = self._hook_module()  # type: ignore [reportPrivateUsage, reportUnknownMemberType]
        # fmt: on

        self._fail_safe.handle_on(
            (
                ClientConnectionError,  # type: ignore [reportOptionalCall, reportUnboundVariable]
                ClientConnectorError,  # type: ignore [reportOptionalCall, reportUnboundVariable]
                ClientSSLError,  # type: ignore [reportOptionalCall, reportUnboundVariable]
            )
        )

    @staticmethod
    def is_hook_supported() -> bool:
        return _hook

    async def make_connection(
        self, url: str, headers: Optional[Dict[str, str]]
    ) -> bool:
        try:
            async with aiohttp.ClientSession() as validate_session:  # type: ignore [reportUnboundVariable]
                async with validate_session.get(
                    url,
                    headers=headers,
                ) as resp:
                    if resp.status == 200:
                        resp_json = await resp.json()
                        self._traffic_filter.managed = resp_json.get("managed", False)
                        return True

        except Exception as e:
            self._logger.warning(f"Establishing handshake with Lunar Proxy. Error: {e}")

        return False

    def _hook_module(self):
        """
        This function will wrap the AioHttp request function and attempt to pass it through Lunar Proxy.
        This wrapper will be called each time AioHttp׳s request method is called.

        Note:
            In case of an error while using Lunar Proxy, the request will be reverted and go directly to the original destination (Without going through Lunar Proxy).
        """

        async def _request(
            client_session: "aiohttp.ClientSession",
            method: str,
            url: "StrOrURL",
            *args: List[Any],
            **kwargs: Dict[str, Any],
        ) -> "aiohttp.client.ClientResponse":
            url_object = client_session._build_url(url)  # type: ignore [reportPrivateUsage]
            original_headers = kwargs.pop(HEADERS_KWARGS_KEY, {}).copy()

            with self._fail_safe:
                if self._fail_safe.state_ok and self._traffic_filter.is_allowed(
                    str(url_object.host), original_headers
                ):
                    return await self._make_request(
                        client_session=client_session,
                        method=method,
                        url_object=url_object,
                        original_headers=original_headers,
                        sequence_id=None,
                        *args,
                        **kwargs,
                    )

            kwargs[HEADERS_KWARGS_KEY] = original_headers
            return await self._original_function(  # type: ignore [reportOptionalCall]
                client_session, method, url, *args, **kwargs
            )

        return _request

    async def _make_request(
        self,
        client_session: "aiohttp.ClientSession",
        method: str,
        url_object: URL,
        original_headers: Dict[str, Any],
        sequence_id: Optional[str] = None,
        *args: List[Any],
        **kwargs: Dict[str, Any],
    ) -> "aiohttp.client.ClientResponse":
        manipulated_headers = generate_modified_headers(
            original_url=url_object,
            original_headers=original_headers,
            sequence_id=sequence_id,
            lunar_tenant_id=self._lunar_tenant_id,
            traffic_filter=self._traffic_filter,
        )

        response = await self._original_function(  # type: ignore [reportOptionalCall]
            self=client_session,
            method=method,
            str_or_url=generate_modified_url(
                self._scheme, self._lunar_proxy, url_object
            ),
            headers=manipulated_headers,
            *args,
            **kwargs,
        )

        self._fail_safe.validate_headers(response.headers)

        retry_sequence_id = await self._prepare_for_retry(response.headers)
        if retry_sequence_id is not None:
            response = await self._make_request(
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
        response._cache[CACHE_HEADERS_KEY] = modified_response_headers  # type: ignore [reportPrivateUsage]

        return response

    async def _prepare_for_retry(self, headers: CIMultiDictProxy[str]) -> Optional[str]:
        raw_retry_after = headers.get(LUNAR_RETRY_AFTER_HEADER_KEY)
        if raw_retry_after is None:
            return None

        sequence_id = headers.get(LUNAR_SEQ_ID_HEADER_KEY)
        if sequence_id is None:
            self._logger.debug(
                f"Retry required, but {LUNAR_SEQ_ID_HEADER_KEY} is missing!"
            )
            return None

        try:
            retry_after = float(raw_retry_after)
        except ValueError:
            self._logger.debug(
                f"Retry required, but parsing header {LUNAR_RETRY_AFTER_HEADER_KEY}"
                + f"as float failed ({raw_retry_after})"
            )
            return None

        self._logger.debug(f"Retry required, will retry in {retry_after} seconds...")
        await sleep(retry_after)
        return sequence_id

    def _generate_modified_response_headers(
        self, original_headers: CIMultiDictProxy[str]
    ) -> CIMultiDictProxy[str]:
        if LUNAR_SEQ_ID_HEADER_KEY not in original_headers:
            return original_headers

        manipulated_headers = original_headers.copy()
        manipulated_headers.pop(LUNAR_SEQ_ID_HEADER_KEY)
        return CIMultiDictProxy(manipulated_headers)
