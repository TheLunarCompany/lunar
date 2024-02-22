# type: ignore

from behave import when, then
from behave.api.async_step import async_run_until_complete
from typing import Any, Literal
from toolkit_testing.integration_tests.client import ProviderClientHelper
from toolkit_testing.integration_tests.routing import Routing
import time

_provider_client_helper = ProviderClientHelper()


@when("A request is sent to Lunar Proxy to get if all endpoints are managed")
@async_run_until_complete
async def step_impl(context: Any):
    path = "/manage_all"
    context.response = await _make_request_to_haproxy_manage_endpoints("GET", path)


@when("A request is sent to Lunar Proxy to manage an endpoint {endpoint_type}")
@async_run_until_complete
async def step_impl(
    context: Any,
    endpoint_type: Literal[
        "with an exact URL",
        "with path parameters",
        "with a wildcard",
        "with path parameters and a wildcard",
    ],
):
    if endpoint_type == "with an exact URL":
        endpoint_regex_pattern = "GET:::exact\.com/my/path$"
        context.matching_endpoint = "GET:::exact.com/my/path"
        context.non_matching_endpoint = "GET:::exact.com/not-my/path"

    elif endpoint_type == "with path parameters":
        endpoint_regex_pattern = "GET:::pathparam\.com/my/path/[^/]+$"
        context.matching_endpoint = "GET:::pathparam.com/my/path/1"
        context.non_matching_endpoint = "GET:::pathparam.com/my/path/1/more/paths"

    elif endpoint_type == "with a wildcard":
        endpoint_regex_pattern = "PUT:::wildcard\.com/my/path(/.*)?"
        context.matching_endpoint = "PUT:::wildcard.com/my/path/with/wildcard/and/more"
        context.non_matching_endpoint = (
            "PUT:::wildcard.com/not-my/path/with/wildcard/and/more"
        )

    elif endpoint_type == "with path parameters and a wildcard":
        endpoint_regex_pattern = "PUT:::mixed\.com/my/path/[^/]+/[^/]+(/.*)?"
        context.matching_endpoint = "PUT:::mixed.com/my/path/1/2/with/wildcard"
        context.non_matching_endpoint = "PUT:::mixed.com/not-my/path/1/2"
    else:
        raise ValueError(
            f"Unexpected value for endpoint_type: {endpoint_type}, expected 'with an exact URL', 'with path parameters', 'with a wildcard' or 'with path parameters and a wildcard'"
        )

    body = endpoint_regex_pattern
    path = "/managed_endpoint"
    await _make_request_to_haproxy_manage_endpoints("PUT", path, body)


@when("A request is sent to Lunar Proxy to get if a {matching} endpoint is managed")
@async_run_until_complete
async def step_impl(context: Any, matching: Literal["matching", "non-matching"]):
    if matching == "matching":
        body = context.matching_endpoint
    elif matching == "non-matching":
        body = context.non_matching_endpoint
    else:
        raise ValueError(
            f"Unexpected value for matching: {matching}, expected 'matching' or 'non-matching'"
        )
    path = "/managed_endpoint"
    context.response = await _make_request_to_haproxy_manage_endpoints(
        "GET", path, body
    )


@when("A request is sent to Lunar Proxy to get if an unknown endpoint is managed")
@async_run_until_complete
async def step_impl(context: Any):
    body = "GET:::unknown.com/hello"
    path = "/managed_endpoint"
    context.response = await _make_request_to_haproxy_manage_endpoints(
        "GET", path, body
    )


@when("A request is sent to Lunar Proxy to manage all endpoints")
@async_run_until_complete
async def step_impl(
    _: Any,
):
    path = "/manage_all"
    await _make_request_to_haproxy_manage_endpoints("PUT", path)


@then("Lunar Proxy returns that the endpoint is {managed}")
@async_run_until_complete
async def step_impl(context: Any, managed: Literal["managed", "not managed"]):
    assert context.response is not None
    assert context.response.status == 200
    if managed == "managed":
        assert context.response.body == "true"
    elif managed == "not managed":
        assert context.response.body == "false"
    else:
        raise ValueError(
            f"Unexpected value for managed: {managed}, expected 'managed' or 'not managed'"
        )


@then("Lunar Proxy returns that all endpoints are {managed}")
@async_run_until_complete
async def step_impl(context: Any, managed: Literal["managed", "not managed"]):
    assert context.response is not None
    assert context.response.status == 200
    print("body is: " + context.response.body)
    if managed == "managed":
        assert context.response.body == "true"
    elif managed == "not managed":
        assert context.response.body == "false"
    else:
        raise ValueError(
            f"Unexpected value for managed: {managed}, expected 'managed' or 'not managed'"
        )


async def _make_request_to_haproxy_manage_endpoints(
    method: str, path: str, body: str | None = None
):
    return await _provider_client_helper.make_request(
        routing=Routing(f"http://localhost", 10252),
        path=path,
        method=method,
        body=body,
    )
