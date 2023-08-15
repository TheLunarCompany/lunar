#  type: ignore

import time
import asyncio

from behave import then, when, register_type
from behave.api.async_step import async_run_until_complete

from utils.client import make_request
from utils.policies import EndpointPolicy, PoliciesRequests

from toolkit_testing.integration_tests.client import ProxyClientHelper, ClientResponse
from toolkit_testing.integration_tests.routing import Routing
from utils.client import extract_scheme, make_request

from typing import Any


@when(
    "policies.yaml includes a concurrency_based_throttling remedy for {method} {host} {path} requests with {response_status_code:Int} response_status_code and {max_concurrent_requests:Int} max_concurrent_requests"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    method: str,
    host: str,
    path: str,
    response_status_code: int,
    max_concurrent_requests: int,
):
    policies_requests: PoliciesRequests = context.policies_requests
    remedy = {
        "name": "test",
        "enabled": True,
        "config": {
            "concurrency_based_throttling": {
                "response_status_code": response_status_code,
                "max_concurrent_requests": max_concurrent_requests,
            }
        },
    }
    policies_requests.endpoints.append(
        EndpointPolicy(method, f"{host}{path}", remedies=[remedy])
    )


@when(
    "{num:Int} concurrent requests (group {group}) to endpoint {host} {path} are made via Lunar Proxy"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    num: int,
    group: str,
    host: str,
    path: str,
):
    tasks = [
        asyncio.create_task(make_request(host, path, is_proxified=True))
        for _ in range(num)
    ]
    responses = await asyncio.gather(*tasks, return_exceptions=True)
    print("*** responses ***")
    print(responses)
    print("***")

    if not hasattr(context, "responses"):
        context.responses = {}

    context.responses[group] = responses


@then(
    "{expected_count:Int} responses from group {group} have status code {status_code:Int}"
)
@async_run_until_complete
async def step_impl(context: Any, expected_count: int, group: str, status_code: int):
    responses: list[ClientResponse] = context.responses[group]
    actual_count = sum(1 for response in responses if response.status == status_code)
    assert expected_count == actual_count
