# type: ignore

from behave import when, then, register_type
from behave.api.async_step import async_run_until_complete
from json import loads
from typing import Any
from features.steps.common import validate_path
from features.steps.common import *

from utils.policies import Account, EndpointPolicy, Header, PoliciesRequests, Token
from toolkit_testing.integration_tests.client import ClientResponse
from utils.client import make_request


@when("policies.yaml includes an accounts section with {num_accounts:Int} accounts")
@async_run_until_complete
async def step_impl(context: Any, num_accounts: int):
    policies_requests: PoliciesRequests = context.policies_requests
    accounts = {}
    for i in range(num_accounts):
        accounts[f"account{i}"] = Account(
            tokens=[Token(Header("Authorization", f"Bearer {i}"))]
        )
    policies_requests.accounts = accounts


@when(
    "policies.yaml includes a {enabled:Enabled} account_orchestration remedy for {method} {host} {path:Path} requests"
)
@async_run_until_complete
async def step_impl(context: Any, method: str, host: str, path: str, enabled: bool):
    policies_requests: PoliciesRequests = context.policies_requests
    account_list = list(policies_requests.accounts.keys())
    remedy = _build_remedy(account_list, enabled)
    url = host + path
    for endpoint_policy in policies_requests.endpoints:
        if endpoint_policy.url == url and endpoint_policy.method == method:
            endpoint_policy.remedies.append(remedy)
            return
    policies_requests.endpoints.append(EndpointPolicy(method, url, remedies=[remedy]))


@when(
    "{number_of_requests:Int} requests are sent to httpbinmock /headers through Lunar Proxy"
)
@async_run_until_complete
async def step_impl(context: Any, number_of_requests: int):
    context.responses = []
    for _ in range(number_of_requests):
        context.responses.append(await make_request("httpbinmock", "/headers", True))


@then(
    "{index1:Index} and {index2:Index} requests are sent with the {accountIndex:Index} account"
)
@async_run_until_complete
async def step_impl(context: Any, index1: int, index2: int, accountIndex: int):
    policies_requests: PoliciesRequests = context.policies_requests
    account_list = list(policies_requests.accounts.keys())
    expected_account = policies_requests.accounts[account_list[accountIndex]]

    response: ClientResponse
    for response in [context.responses[index1], context.responses[index2]]:
        json_body = loads(response.body)
        print(f"Response: {json_body}")

        for token in expected_account.tokens:
            assert (
                json_body["headers"][token.header.name] == token.header.value
            ), f"Token {token} not found in response: {json_body}"


def _build_remedy(account_list: list[str], enabled: bool = True):
    remedy = {
        "name": "Account Orchestration",
        "enabled": enabled,
        "config": {"account_orchestration": {"round_robin": account_list}},
    }

    return remedy
