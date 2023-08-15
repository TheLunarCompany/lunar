# type: ignore

from behave import given, when, then, register_type
from behave.api.async_step import async_run_until_complete
from typing import Any, Dict
from asyncio import sleep
from dataclasses import dataclass
from json import loads

from toolkit_testing.integration_tests.mox import MoxHelper
from toolkit_testing.integration_tests.client import ProxyClientHelper, ClientResponse
from toolkit_testing.integration_tests.routing import Routing

from utils.policies import PoliciesRequests, EndpointPolicy
from utils.consts import *
from utils.client import extract_scheme

_mox_helper = MoxHelper(host="http://localhost", port=8888)
_client_helper = ProxyClientHelper(proxy_host="http://localhost", proxy_port=8000)


@dataclass
class ClientResponseWithRequestID:
    request_id: int
    body: str
    headers: Dict[str, str]
    status: int


def parse_int(text: str) -> int:
    return int(text)


register_type(Int=parse_int)


@given("{num:Int} remaining requests until rate limit threshold is reached")
@async_run_until_complete
async def step_impl(context: Any, num: int):
    endpoint_result = await _mox_helper.set_mox_proxy_path(
        MOX_GET_THROTTLE_OK_ENDPOINT_REQUEST,
    )
    context.endpoint_id = endpoint_result
    context.remaining_requests = num


@when(
    "{num:Int} requests to rate limited endpoint {scheme}:// {host} :{port:Int} {path:Path} are made via Lunar Proxy"
)
@async_run_until_complete
async def step_impl(
    context: Any, num: int, scheme: str, host: str, port: int, path: str
):
    context.responses = await _make_requests_with_rate_limit(
        host=host,
        path=path,
        scheme=scheme,
        port=port,
        num_requests=num,
        remaining_requests=context.remaining_requests,
        endpoint_id=context.endpoint_id,
    )


@when("current rate limit window passes")
@async_run_until_complete
async def step_impl(_: Any):
    await _wait_for_retry_after()


@when(
    "policies.yaml includes a response_based_throttling remedy for {method} {host} {path:Path} requests for {status:Int} status using {header_name} header as {header_value_type}"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    method: str,
    host: str,
    path: str,
    status: int,
    header_name: str,
    header_value_type: str,
):
    policies_requests: PoliciesRequests = context.policies_requests
    remedy = {
        "name": f"response_based_throttling for {method} {host}/{path}",
        "enabled": True,
        "config": {
            "response_based_throttling": {
                "quota_group": 1,
                "retry_after_header": header_name,
                "retry_after_type": header_value_type,
                "relevant_statuses": [status],
            }
        },
    }
    policies_requests.endpoints.append(
        EndpointPolicy(method, f"{host}{path}", remedies=[remedy])
    )


@when(
    "1 request to rate limited endpoint {scheme}:// {host} :{port:Int} {path:Path} is made via Lunar Proxy"
)
@async_run_until_complete
async def step_impl(context: Any, scheme: str, host: str, port: int, path: str):
    response = await _request(
        host=host, path=_path_with_request_id(path, 4), scheme=scheme, port=port
    )

    context.responses.append(
        ClientResponseWithRequestID(
            request_id=4,
            body=response.body,
            headers=dict(response.headers),
            status=response.status,
        )
    )


@then("first 2 responses have status 200")
@async_run_until_complete
async def step_impl(context: Any):
    for i, response in enumerate(context.responses[:2]):
        assert response.status == 200
        assert loads(response.body) == _expected_body(response.request_id)


@then("3rd & 4th response have status 429 and their body is the same")
@async_run_until_complete
async def step_impl(context: Any):
    start = 2
    end = 4
    for response in context.responses[start:end]:
        assert response.status == 429
        assert loads(response.body) == _expected_body(request_id=start)


@then("5th response has status 200")
@async_run_until_complete
async def step_impl(context: Any):
    request_id = 4
    response = context.responses[request_id]

    assert response.status == 200
    assert loads(response.body) == _expected_body(response.request_id)


def _expected_body(request_id: int):
    return {"request_id": str(request_id)}


async def _request(
    host: str,
    path: str,
    scheme: str,
    port: int,
) -> ClientResponse:
    response = await _client_helper.make_request(
        routing=Routing(
            requested_host=host,
            requested_scheme=extract_scheme(scheme),
            requested_port=port,
        ),
        path=path,
    )
    return response


async def _make_requests_with_rate_limit(
    host: str,
    path: str,
    scheme: str,
    port: int,
    num_requests: int,
    remaining_requests: int,
    endpoint_id: int,
) -> list[ClientResponseWithRequestID]:
    responses = []
    for i in range(num_requests):
        await _check_rate_limit(remaining_requests, i, endpoint_id)
        res = await _request(
            host=host, path=_path_with_request_id(path, i), scheme=scheme, port=port
        )
        response = ClientResponseWithRequestID(
            request_id=i, body=res.body, status=res.status, headers=res.headers
        )
        responses.append(response)

    await _allow(endpoint_id)

    return responses


def _path_with_request_id(path, request_id):
    return f"{path}?request_id={request_id}"


async def _check_rate_limit(remaining_requests: int, count: int, endpoint_id: int):
    if count == remaining_requests:
        await _rate_limit(endpoint_id)


async def _rate_limit(endpoint_id: int):
    assert await _mox_helper.update_mox_proxy_path(
        endpoint_id, MOX_GET_THROTTLE_ERROR_REQUEST
    )


async def _allow(endpoint_id: str):
    assert await _mox_helper.update_mox_proxy_path(
        endpoint_id, MOX_GET_THROTTLE_OK_ENDPOINT_REQUEST
    )


async def _wait_for_retry_after():
    await sleep(RETRY_AFTER_TIME)
