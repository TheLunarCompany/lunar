# type: ignore

from behave import when, then, register_type
from behave.api.async_step import async_run_until_complete
from json import loads
from typing import Any
from features.steps.common import *

from utils.policies import (
    Account,
    EndpointPolicy,
    Header,
    Body,
    PoliciesRequests,
    BasicAuth,
    OAuth,
    APIKey,
    Authentication,
)


def parse_int(text: str) -> int:
    return int(text)


register_type(Status=parse_int)


@when("policies.yaml includes accounts section with all auth accounts")
@async_run_until_complete
async def step_impl(context: Any):
    policies_requests: PoliciesRequests = context.policies_requests
    header_token = Header(name="Apikeyname", value="APIKeyValue")
    body_token = Body(name="OAuthName", value="OAuthValue")

    basic_auth = Authentication(
        basic=BasicAuth(username="BasicName", password="BasicValue")
    )
    o_auth = Authentication(o_auth=OAuth(tokens=[body_token]))
    api_auth = Authentication(api_key=APIKey(tokens=[header_token]))

    policies_requests.accounts = {
        "basic": Account(authentication=basic_auth),
        "o_auth": Account(authentication=o_auth),
        "api_key": Account(authentication=api_auth),
    }


@when(
    "policies.yaml includes a {enabled:Enabled} authentication of type {auth_type} for {method} {host} {path:Path} requests"
)
@async_run_until_complete
async def step_impl(
    context: Any, auth_type: str, method: str, host: str, path: str, enabled: bool
):
    policies_requests: PoliciesRequests = context.policies_requests
    remedy = _build_remedy(auth_type, enabled)
    url = host + path
    for endpoint_policy in policies_requests.endpoints:
        if endpoint_policy.url == url and endpoint_policy.method == method:
            endpoint_policy.remedies.append(remedy)
            return
    policies_requests.endpoints.append(EndpointPolicy(method, url, remedies=[remedy]))


@then('Request was sent with "{header_name}" header with value "{header_value}"')
@async_run_until_complete
async def step_impl(context: Any, header_name: str, header_value: str):
    body = loads(context.proxified_response.body)
    headers = body.get("headers", {})
    print(f"Response headers: {headers}")
    print(f"needed headers: {header_name}")
    assert header_name in headers
    print(f"Found header {headers[header_name]} but expected {header_value}")
    assert headers[header_name] == header_value


def _build_remedy(account_name: str, enabled: bool = True):
    remedy = {
        "name": "Auth-Management",
        "enabled": enabled,
        "config": {"authentication": {"account": account_name}},
    }

    return remedy


@then('Request was sent with "{body_name}" body key with value "{body_value}"')
@async_run_until_complete
async def step_impl(context: Any, body_name: str, body_value: str):
    body = loads(context.proxified_response.body)
    body = body.get("json", {})
    print(f"Response body: {body}")
    assert body_name in body

    print(f"Found value {body[body_name]} but expected {body_value}")
    assert body[body_name] == body_value


@then("Request headers are not modified")
@async_run_until_complete
async def step_impl(context: Any):
    body = loads(context.proxified_response.body)
    original_request_headers = context.proxified_response.request_headers
    request_headers = body.get("headers", {})
    print(f"Request original headers: {original_request_headers}")
    print(f"Request headers: {request_headers}")

    for key, value in request_headers.items():
        assert request_headers[key] == value


def _build_remedy(account_name: str, enabled: bool = True):
    remedy = {
        "name": "Auth-Management",
        "enabled": enabled,
        "config": {"authentication": {"account": account_name}},
    }

    return remedy
