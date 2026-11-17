# type: ignore
# This is since `behave` is really mistyped and all dynamic.
# Might be handled later.
import asyncio

from behave import when, then, register_type
from behave.api.async_step import async_run_until_complete
from typing import Any

from toolkit_testing.integration_tests.docker import kill_signal
from toolkit_testing.integration_tests.routing import Routing
from toolkit_testing.integration_tests.client import ProxyClientHelper
from utils.consts import *

_proxy_client_helper = ProxyClientHelper(proxy_host="http://localhost", proxy_port=8000)


def parse_status_code(text: str) -> int:
    return int(text)


register_type(Status=parse_status_code)


@when("Request is made through Lunar Proxy to a high-latency provider")
@async_run_until_complete
async def step_impl(context: Any):
    context.response_pre_shutdown = asyncio.create_task(
        _proxy_client_helper.make_request(
            routing=Routing("httpbinmock", 80), path="/delay/5"
        )
    )


@when("Lunar Proxy is stopped gracefully with {signal} before response is obtained")
@async_run_until_complete
async def step_impl(context: Any, signal: str):
    await kill_signal(LUNAR_PROXY_SERVICE_NAME, signal)


@when("Another request is made after graceful shutdown started")
@async_run_until_complete
async def step_impl(context: Any):
    context.response_post_shutdown = asyncio.create_task(
        _proxy_client_helper.make_request(
            routing=Routing("httpbinmock", 80), path="/delay/3"
        )
    )


@then("The response for the request pre-shutdown is {status:Status}")
@async_run_until_complete
async def step_impl(context: Any, status: int):
    await context.response_pre_shutdown
    print(context.response_pre_shutdown.result())
    assert context.response_pre_shutdown.result().status == status


@then("The response for request post-shutdown is {status:Status}")
@async_run_until_complete
async def step_impl(context: Any, status: int):
    await context.response_post_shutdown
    print("************")
    print(context.response_post_shutdown.result())
    print("************")
    assert context.response_post_shutdown.result().status == status
