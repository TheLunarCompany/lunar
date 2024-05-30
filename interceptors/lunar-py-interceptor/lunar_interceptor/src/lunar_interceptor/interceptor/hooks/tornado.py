from dataclasses import dataclass
import logging
from time import sleep
from json import loads
from typing import Any, Dict, Optional, Union, List
from socket import gaierror
from yarl import URL

from lunar_interceptor.interceptor.fail_safe import FailSafe
from lunar_interceptor.interceptor.hooks.hook import LunarHook
from lunar_interceptor.interceptor.traffic_filter import TrafficFilter
from lunar_interceptor.interceptor.configuration import ConnectionConfig
from lunar_interceptor.interceptor.hooks.const import (
    LUNAR_RETRY_AFTER_HEADER_KEY,
    LUNAR_SEQ_ID_HEADER_KEY,
    FOLLOW_REDIRECTS_KEY,
    HEADERS_KWARGS_KEY,
)
from lunar_interceptor.interceptor.hooks.helpers import (
    generate_request_id,
    generate_modified_headers,
    generate_modified_url,
)

_hook = True

try:
    from tornado import httpclient, httputil  # type: ignore [reportMissingModuleSource]

except ImportError:
    _hook = False


@dataclass
class tornadoRequestObject:
    original_request_arg: Union["httpclient.HTTPRequest", str]
    is_HTTPRequest: bool
    original_headers: Dict[str, str]
    original_url: URL
    lunar_req_id: str
    modified_request: Optional["httpclient.HTTPRequest"] = None
    modified_headers: Optional[Dict[str, str]] = None


class TornadoHook(LunarHook):
    def __init__(
        self,
        logger: logging.Logger,
        fail_safe: FailSafe,
        traffic_filter: TrafficFilter,
        lunar_proxy_configuration: ConnectionConfig,
    ) -> None:
        self._connection_config = lunar_proxy_configuration
        self._logger = logger
        self._traffic_filter = traffic_filter
        self._fail_safe = fail_safe
        self._original_function = httpclient.AsyncHTTPClient.fetch  # type: ignore [reportPrivateUsage, reportUnknownMemberType]

        self._fail_safe.handle_on(
            (
                httpclient.HTTPClientError,  # type: ignore [reportOptionalCall]
                gaierror,
            )
        )

    @staticmethod
    def is_hook_supported() -> bool:
        return _hook

    def init_hooks(self) -> None:
        self._logger.debug("Initializing Tornado Hooks")
        httpclient.AsyncHTTPClient.fetch = self._hook_module()  # type: ignore [reportPrivateUsage, reportUnknownMemberType]

    def remove_hooks(self) -> None:
        self._logger.debug("Removing Tornado Hooks")
        httpclient.AsyncHTTPClient.fetch = self._original_function  # type: ignore [reportPrivateUsage, reportUnknownMemberType]

    async def make_connection(
        self, url: str, headers: Optional[Dict[str, str]]
    ) -> bool:
        try:
            http_client = httpclient.AsyncHTTPClient()  # type: ignore [reportUnboundVariable]
            response = await http_client.fetch(url, headers=headers)

            if response.code == 200:
                resp_json = loads(response.body.decode())
                self._traffic_filter.managed = resp_json.get("managed", False)
                return True

        except Exception as e:
            self._logger.warning(f"Establishing handshake with Lunar Proxy. Error: {e}")

        return False

    def _hook_module(self):
        async def _request(
            async_http_client: "httpclient.AsyncHTTPClient",
            request: Union["httpclient.HTTPRequest", str],
            raise_error: bool = True,
            **kwargs: Any,
        ) -> "httpclient.HTTPResponse":
            headers = dict(kwargs.pop(HEADERS_KWARGS_KEY, {}))

            tornado_request = self._prepare_tornado_request(request, headers, **kwargs)

            with self._fail_safe:
                if self._fail_safe.state_ok and self._traffic_filter.is_allowed(
                    str(tornado_request.original_url.host),
                    tornado_request.original_headers,
                ):
                    return await self._make_request(
                        async_http_client=async_http_client,
                        raise_error=raise_error,
                        tornado_request=tornado_request,
                        sequence_id=None,
                        **kwargs,
                    )

            self._logger.debug(
                f"Request {tornado_request.lunar_req_id} - Will send {tornado_request.original_url} without using Lunar Proxy"
            )

            if tornado_request.is_HTTPRequest:
                return await self._original_function(
                    self=async_http_client,
                    request=tornado_request.original_request_arg,
                    raise_error=raise_error,
                )

            return await self._original_function(
                self=async_http_client,
                request=tornado_request.original_request_arg,
                raise_error=raise_error,
                headers=tornado_request.original_headers,
                **kwargs,
            )

        return _request

    async def _make_request(
        self,
        async_http_client: "httpclient.AsyncHTTPClient",
        raise_error: bool,
        tornado_request: tornadoRequestObject,
        sequence_id: Optional[str] = None,
        **kwargs: Any,
    ) -> "httpclient.HTTPResponse":

        tornado_request = self._modify_tornado_request(
            tornado_request, sequence_id, **kwargs
        )
        self._logger.debug(
            f"Request {tornado_request.lunar_req_id} - Forwarding the request to \
            {tornado_request.modified_request.url} using Lunar Proxy"  # type: ignore [reportUnboundVariable]
        )

        response = await self._original_function(
            self=async_http_client,
            request=tornado_request.modified_request,  # type: ignore [reportUnboundVariable]
            raise_error=raise_error,
        )

        if response.error:
            raise response.error

        self._fail_safe.validate_headers(response.headers)

        retry_sequence_id = self._prepare_requests_for_retry(
            response.headers, tornado_request.lunar_req_id
        )

        if retry_sequence_id is not None:
            response = await self._make_request(
                async_http_client=async_http_client,
                raise_error=raise_error,
                tornado_request=tornado_request,
                sequence_id=retry_sequence_id,
            )

        modified_response_headers = self._generate_modified_response_headers(
            response.headers
        )
        response.headers = modified_response_headers  # type: ignore [reportPrivateUsage]

        return response

    def _prepare_tornado_request(
        self,
        request: Union["httpclient.HTTPRequest", str],
        headers: Dict[str, str],
        **kwargs: Any,
    ) -> tornadoRequestObject:
        is_HTTPRequest = False
        if not isinstance(request, httpclient.HTTPRequest):  # type: ignore [reportUnboundVariable]
            http_request = httpclient.HTTPRequest(  # type: ignore [reportUnboundVariable]
                url=request, headers=headers, **kwargs
            )
        else:
            is_HTTPRequest = True
            http_request = request

        return tornadoRequestObject(
            original_request_arg=request,
            is_HTTPRequest=is_HTTPRequest,
            original_url=URL(http_request.url),  # type: ignore [reportUnboundVariable]
            original_headers={key.lower(): value for key, value in headers.items()},
            lunar_req_id=generate_request_id(),
        )

    def _modify_tornado_request(
        self,
        tornado_request: tornadoRequestObject,
        sequence_id: Optional[str],
        **kwargs: Any,
    ) -> tornadoRequestObject:
        manipulated_headers = generate_modified_headers(
            original_url=tornado_request.original_url,
            original_headers=tornado_request.original_headers,
            sequence_id=sequence_id,
            lunar_tenant_id=self._connection_config.tenant_id,
            traffic_filter=self._traffic_filter,
            lunar_req_id=tornado_request.lunar_req_id,
        )

        modified_url = generate_modified_url(
            self._connection_config, tornado_request.original_url
        )

        modified_headers = tornado_request.original_headers.copy()
        modified_headers.update(manipulated_headers)
        kwargs.pop(FOLLOW_REDIRECTS_KEY, None)
        # MARK: - We should think about how to handle redirects when using our proxy
        modified_request = httpclient.HTTPRequest(  # type: ignore [reportUnboundVariable]
            url=str(modified_url),
            headers=modified_headers,
            follow_redirects=False,
            **kwargs,
        )

        tornado_request.modified_request = modified_request
        return tornado_request

    def _prepare_requests_for_retry(
        self,
        headers: "httputil.HTTPHeaders",
        lunar_req_id: str,
    ) -> Optional[str]:
        raw_retry_after = headers.get_list(LUNAR_RETRY_AFTER_HEADER_KEY)
        if not raw_retry_after:
            return None

        sequence_id = headers.get_list(LUNAR_SEQ_ID_HEADER_KEY)[0]
        if sequence_id == "":
            self._logger.debug(
                f"Request {lunar_req_id} - Retry required, but {LUNAR_SEQ_ID_HEADER_KEY} is missing!"
            )
            return None

        try:
            retry_after = float(raw_retry_after[0])
        except ValueError:
            self._logger.debug(
                f"Request {lunar_req_id} - Retry required, but parsing header {LUNAR_RETRY_AFTER_HEADER_KEY}"
                + f"as float failed ({raw_retry_after})"
            )
            return None

        self._logger.debug(
            f"Request {lunar_req_id} - Retry required, will retry in {retry_after} seconds..."
        )
        sleep(retry_after)
        return sequence_id

    def _generate_modified_response_headers(
        self, original_headers: "httputil.HTTPHeaders"
    ) -> "httputil.HTTPHeaders":
        if not original_headers.get_list(LUNAR_SEQ_ID_HEADER_KEY):
            return original_headers

        original_as_dict: Dict[str, List[str]] = dict(original_headers.copy())
        manipulated_headers: Dict[str, List[str]] = {
            key.lower(): value for key, value in original_as_dict.items()
        }

        manipulated_headers.pop(LUNAR_SEQ_ID_HEADER_KEY)
        return httputil.HTTPHeaders(manipulated_headers)  # type: ignore [reportUnboundVariable]
