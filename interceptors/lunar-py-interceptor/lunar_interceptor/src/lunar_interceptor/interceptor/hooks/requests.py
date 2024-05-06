import logging
from time import sleep
from json import loads
from typing import Any, List, Dict, Optional

from lunar_interceptor.interceptor.hooks.const import *
from lunar_interceptor.interceptor.hooks.helpers import *
from lunar_interceptor.interceptor.fail_safe import FailSafe
from lunar_interceptor.interceptor.hooks.hook import LunarHook
from lunar_interceptor.interceptor.traffic_filter import TrafficFilter
from lunar_interceptor.interceptor.configuration import ConnectionConfig

_hook = True

try:
    import requests  # type: ignore [reportMissingModuleSource]

except ImportError:
    _hook = False


class RequestsHook(LunarHook):
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
        self._original_function = requests.Session.request  # type: ignore [reportPrivateUsage, reportUnknownMemberType]

        self._fail_safe.handle_on(
            (requests.ConnectionError,)  # type: ignore [reportOptionalCall]
        )

    @staticmethod
    def is_hook_supported() -> bool:
        return _hook

    def init_hooks(self) -> None:
        self._logger.debug("Initializing Requests Hook")
        requests.Session.request = self._hook_module()  # type: ignore [reportPrivateUsage, reportUnknownMemberType]

    def remove_hooks(self) -> None:
        self._logger.debug("Removing Requests Hook")
        requests.Session.request = self._original_function  # type: ignore [reportPrivateUsage, reportUnknownMemberType]

    async def make_connection(
        self, url: str, headers: Optional[Dict[str, str]]
    ) -> bool:
        try:
            response = requests.get(url, headers=headers)  # type: ignore [reportUnboundVariable]

            if response.status_code == 200:
                resp_json = loads(response.content)
                self._traffic_filter.managed = resp_json.get("managed", False)
                return True

        except Exception as e:
            self._logger.warning(f"Establishing handshake with Lunar Proxy. Error: {e}")

        return False

    def _hook_module(self):
        def _request(
            client_session: "requests.sessions.Session",
            method: str,
            url: str,
            *args: List[Any],
            **kwargs: Dict[str, Any],
        ) -> "requests.Response":
            lunar_req_id = generate_request_id()
            url_obj = URL(url)
            original_headers = kwargs.pop(HEADERS_KWARGS_KEY, {})

            with self._fail_safe:
                if self._fail_safe.state_ok and self._traffic_filter.is_allowed(
                    str(url_obj.host), original_headers
                ):
                    return self._make_request(
                        client_session=client_session,
                        method=method,
                        url_object=url_obj,
                        original_headers=original_headers,
                        lunar_req_id=lunar_req_id,
                        sequence_id=None,
                        *args,
                        **kwargs,
                    )

            kwargs[HEADERS_KWARGS_KEY] = original_headers
            self._logger.debug(
                f"Request {lunar_req_id} - Will send {url_obj} without using Lunar Proxy"
            )
            return self._original_function(
                self=client_session, method=method, url=url, *args, **kwargs
            )

        return _request

    def _make_request(
        self,
        client_session: "requests.sessions.Session",
        method: str,
        url_object: URL,
        original_headers: Dict[str, Any],
        lunar_req_id: str,
        sequence_id: Optional[str] = None,
        *args: List[Any],
        **kwargs: Dict[str, Any],
    ) -> "requests.Response":
        manipulated_headers = generate_modified_headers(
            original_url=url_object,
            original_headers=original_headers,
            sequence_id=sequence_id,
            lunar_tenant_id=self._connection_config.tenant_id,
            traffic_filter=self._traffic_filter,
            lunar_req_id=lunar_req_id,
        )
        modified_url = str(
            generate_modified_url(
                self._connection_config.proxy_scheme,
                self._connection_config.proxy_host_with_port,
                url_object,
            ),
        )
        self._logger.debug(
            f"Request {lunar_req_id} - Forwarding the request to {modified_url} using Lunar Proxy"
        )
        response = self._original_function(
            self=client_session,
            method=method,
            url=modified_url,
            headers=manipulated_headers,
            *args,
            **kwargs,
        )

        self._fail_safe.validate_headers(response.headers)

        retry_sequence_id = self._prepare_requests_for_retry(
            response.headers, lunar_req_id
        )
        if retry_sequence_id is not None:
            response = self._make_request(
                client_session=client_session,
                method=method,
                url_object=url_object,
                original_headers=original_headers,
                lunar_req_id=lunar_req_id,
                sequence_id=retry_sequence_id,
                *args,
                **kwargs,
            )

        modified_response_headers = self._generate_modified_response_headers(
            response.headers
        )
        response.headers = modified_response_headers  # type: ignore [reportPrivateUsage]

        return response

    def _prepare_requests_for_retry(
        self,
        headers: "requests.models.CaseInsensitiveDict[str]",
        lunar_req_id: str,
    ) -> Optional[str]:
        raw_retry_after = headers.get(LUNAR_RETRY_AFTER_HEADER_KEY)
        if raw_retry_after is None:
            return None

        sequence_id = headers.get(LUNAR_SEQ_ID_HEADER_KEY)
        if sequence_id is None:
            self._logger.debug(
                f"Request {lunar_req_id} - Retry required, but {LUNAR_SEQ_ID_HEADER_KEY} is missing!"
            )
            return None

        try:
            retry_after = float(raw_retry_after)
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
        self, original_headers: "requests.models.CaseInsensitiveDict[str]"
    ) -> "requests.models.CaseInsensitiveDict[str]":
        if LUNAR_SEQ_ID_HEADER_KEY not in original_headers:
            return original_headers

        manipulated_headers = original_headers.copy()
        manipulated_headers.pop(LUNAR_SEQ_ID_HEADER_KEY)
        return requests.models.CaseInsensitiveDict(manipulated_headers)  # type: ignore [reportUnboundVariable]
