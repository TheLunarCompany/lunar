# type: ignore
# This is since `behave` is really mistyped and all dynamic.
# Might be handled later.
from behave import then, register_type
from behave.api.async_step import async_run_until_complete
from json import dumps, loads
from typing import Any
from utils.policies import EndpointPolicy, PoliciesRequests
import uuid

_EARLY_RESPONSE_BODY = dumps(loads('{"message": "GO Lunar"}'))


def parse_int(text: str) -> int:
    return int(text)


register_type(Int=parse_int)


@when(
    "policies.yaml includes a fixed_response remedy for {method} {host} {path:Path} requests with status code {code:Status}"
)
def step_impl(context: Any, method: str, host: str, path: str, code: int):
    policies_requests: PoliciesRequests = context.policies_requests
    remedy = {
        "name": f"fixed response remedy {uuid.uuid4()}",
        "enabled": True,
        "config": {"fixed_response": {"status_code": code}},
    }
    policies_requests.endpoints.append(
        EndpointPolicy(method, f"{host}{path}", remedies=[remedy])
    )


@when(
    "policies.yaml includes a fixed_response remedy for {method} {host} {path:Path} requests with invalid config"
)
def step_impl(context: Any, method: str, host: str, path: str):
    policies_requests: PoliciesRequests = context.policies_requests
    remedy = {
        "name": f"fixed response remedy {uuid.uuid4()}",
        "enabled": True,
        "config": {"fixed_response": {"status_code": "cannot be a string!"}},
    }
    policies_requests.endpoints.append(
        EndpointPolicy(method, f"{host}{path}", remedies=[remedy])
    )


@then("Fixed response is returned with status code {status:Int}")
@async_run_until_complete
async def step_impl(context: Any, status: int):
    assert loads(context.proxified_response.body) == loads(_EARLY_RESPONSE_BODY)
    assert context.proxified_response.status == status
