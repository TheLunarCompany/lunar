# type: ignore
from behave import when, then, register_type
from behave.api.async_step import async_run_until_complete
from typing import Any
from utils.policies import EndpointPolicy, PoliciesRequests


def parse_int(text: str) -> int:
    return int(text)


register_type(Int=parse_int)


@when(
    "policies.yaml includes retry remedy for {method} {host} {path:Path} requests with attempts={attempts:Int}, initial_cooldown_seconds={initial_cooldown_seconds:Int} and cooldown_multiplier={cooldown_multiplier:Int}"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    method: str,
    host: str,
    path: str,
    attempts: int,
    initial_cooldown_seconds: int,
    cooldown_multiplier: int,
):
    policies_requests: PoliciesRequests = context.policies_requests
    context.account_list = list(policies_requests.accounts.keys())
    remedy = {
        "name": f"retry for {method} {host}{path}",
        "enabled": True,
        "config": {
            "retry": {
                "attempts": attempts,
                "initial_cooldown_seconds": initial_cooldown_seconds,
                "cooldown_multiplier": cooldown_multiplier,
                # for simplicity purposes, this config simply assumes all errors should be retried
                "conditions": {"status_code": [{"from": 400, "to": 599}]},
            }
        },
    }
    policies_requests.endpoints.append(
        EndpointPolicy(method, f"{host}{path}", remedies=[remedy])
    )
