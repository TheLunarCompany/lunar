# type: ignore
import time

from behave import then, when, register_type
from behave.api.async_step import async_run_until_complete

from dataclasses import dataclass
from enum import Enum
from utils.client import make_request
from utils.consts import DEFAULT_LUNAR_PROXY_ID
from utils.policies import EndpointPolicy, PoliciesRequests
import uuid

from typing import Any, Optional


@dataclass
class QuotaAllocation:
    value: str
    allocation_percentage: float


class DefaultBehavior(Enum):
    UNDEFINED = "undefined"
    ALLOW = "allow"
    BLOCK = "block"
    USE_DEFAULT_ALLOCATION = "use_default_allocation"


@dataclass
class DefaultBehaviourDefinition:
    default_behaviour: DefaultBehavior
    default_allocation_percentage: float


def parse_quota_allocation_groups(text: str) -> list[QuotaAllocation]:
    """
    Parses a list of quota allocations in the form of:
    65% to "123" and 25% to "456" and 10% to "789"
    to a list of QuotaAllocation objects, in this case:
    [QuotaAllocation(value="123", allocation_percentage=0.75), QuotaAllocation(value="456", allocation_percentage=0.25)]
    """
    quota_allocations = []
    for group_quota_allocation in text.split(" and "):
        allocation_percentage, value = group_quota_allocation.split("% to ")
        quota_allocations.append(QuotaAllocation(value, float(allocation_percentage)))

    return quota_allocations


def parse_default_behaviour(text: str) -> DefaultBehaviourDefinition:
    behaviour, allocation = text.split(" with default allocation percentage ")
    allocation_percentage = float(allocation.rstrip("%"))
    definition = DefaultBehaviourDefinition(
        parse_default_behaviour_name(behaviour), float(allocation_percentage)
    )

    raise Exception(f"Unknown default behaviour: {text}")


def parse_default_behaviour_name(behavior_text: str) -> DefaultBehavior:
    match behaviour:
        case "allow":
            return DefaultBehavior.ALLOW
        case "block":
            return DefaultBehavior.BLOCK
        case "use default allocation":
            return DefaultBehavior.USE_DEFAULT_ALLOCATION
        case "undefined":
            return DefaultBehavior.UNDEFINED


register_type(QuotaAllocationGroups=parse_quota_allocation_groups)
register_type(DefaultBehavior=parse_default_behaviour)


def add_strategy_based_throttling_to_policies(
    policies_requests: PoliciesRequests,
    allowed_requests: int,
    time_window: int,
    method: str,
    host: str,
    path: str,
    spillover_enabled: bool = False,
    group_by: str = None,
    quota_allocations: list[QuotaAllocation] = None,
    default_behavior: DefaultBehavior = None,
):
    remedy = _build_remedy(
        allowed_requests=allowed_requests,
        time_window=time_window,
        spillover_enabled=spillover_enabled,
        group_by=group_by,
        quota_allocations=quota_allocations,
        default=default_behavior,
    )
    policies_requests.endpoints.append(
        EndpointPolicy(method, f"{host}{path}", remedies=[remedy])
    )


@when(
    "policies.yaml includes a strategy_based_throttling remedy for {method} {host} {path} requests with {allowed_requests:Int} requests per {time_window:Int} seconds"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    method: str,
    host: str,
    path: str,
    allowed_requests: int,
    time_window: int,
):
    add_strategy_based_throttling_to_policies(
        policies_requests=context.policies_requests,
        allowed_requests=allowed_requests,
        time_window=time_window,
        method=method,
        host=host,
        path=path,
    )


@when(
    "policies.yaml includes a strategy_based_throttling remedy for {method} {host} {path} requests with {allowed_requests:Int} requests per {time_window:Int} seconds spillover is {spillover_enabled:Enabled}"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    method: str,
    host: str,
    path: str,
    allowed_requests: int,
    time_window: int,
    spillover_enabled: bool,
):
    add_strategy_based_throttling_to_policies(
        policies_requests=context.policies_requests,
        allowed_requests=allowed_requests,
        time_window=time_window,
        spillover_enabled=spillover_enabled,
        method=method,
        host=host,
        path=path,
    )


@when(
    "policies.yaml includes a strategy_based_throttling remedy for GET {host} {path} requests with {allowed_requests:Int} requests per {time_window:Int} seconds grouped by {group_by} header"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    host: str,
    path: str,
    allowed_requests: int,
    time_window: int,
    group_by: str,
):
    add_strategy_based_throttling_to_policies(
        context.policies_requests,
        allowed_requests=allowed_requests,
        time_window=time_window,
        group_by=group_by,
        method="GET",
        host=host,
        path=path,
    )


@when(
    "policies.yaml includes a strategy_based_throttling remedy for GET {host} {path} requests with {allowed_requests:Int} requests per {time_window:Int} seconds grouped by {group_by} header with quota_allocations of {quota_allocations:QuotaAllocationGroups}"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    host: str,
    path: str,
    allowed_requests: int,
    time_window: int,
    group_by: str,
    quota_allocations: list[QuotaAllocation],
):
    add_strategy_based_throttling_to_policies(
        context.policies_requests,
        allowed_requests=allowed_requests,
        time_window=time_window,
        group_by=group_by,
        quota_allocations=quota_allocations,
        method="GET",
        host=host,
        path=path,
    )


@when(
    "policies.yaml includes a strategy_based_throttling remedy for GET {host} {path} requests with {allowed_requests:Int} requests per {time_window:Int} seconds grouped by {group_by} header with quota_allocations {quota_allocations:QuotaAllocationGroups} with default behaviour {default_behaviour:DefaultBehavior}"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    host: str,
    path: str,
    allowed_requests: int,
    time_window: int,
    group_by: str,
    quota_allocations: list[QuotaAllocation],
    default_behaviour: DefaultBehavior,
):
    add_strategy_based_throttling_to_policies(
        context.policies_requests,
        allowed_requests=allowed_requests,
        time_window=time_window,
        group_by=group_by,
        quota_allocations=quota_allocations,
        default_behaviour=default_behaviour,
        method="GET",
        host=host,
        path=path,
    )


@when("1 request is sent to {host} {path} through Lunar Proxy")
@when("1 request is sent to {host} {path} through {proxy_id:Proxy} Shared Lunar Proxy")
@async_run_until_complete
async def step_impl(
    context: Any, host: str, path: str, proxy_id: str = DEFAULT_LUNAR_PROXY_ID
):
    context.responses = context.responses if hasattr(context, "responses") else []
    context.responses.append(await make_request(host, path, True, proxy_id=proxy_id))


@when(
    "1 request is sent to {host} {path} through Lunar Proxy with {header_name} header set to {header_value}"
)
@when(
    "1 request is sent to {host} {path} through {proxy_id:Proxy} Shared Lunar Proxy with {header_name} header set to {header_value}"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    host: str,
    path: str,
    header_name: str,
    header_value: str,
    proxy_id: str = DEFAULT_LUNAR_PROXY_ID,
):
    context.responses = context.responses if hasattr(context, "responses") else []
    context.responses.append(
        await make_request(
            host,
            path,
            is_proxified=True,
            header_key=header_name,
            header_value=header_value,
            proxy_id=proxy_id,
        )
    )


@when("{number_of_requests:Int} requests are sent to {host} {path} through Lunar Proxy")
@when(
    "{number_of_requests:Int} requests are sent to {host} {path} through {proxy_id:Proxy} Shared Lunar Proxy"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    number_of_requests: int,
    host: str,
    path: str,
    proxy_id: str = DEFAULT_LUNAR_PROXY_ID,
):
    context.responses = context.responses if hasattr(context, "responses") else []
    for _ in range(number_of_requests):
        context.responses.append(
            await make_request(host, path, is_proxified=True, proxy_id=proxy_id)
        )
        # 10ms, otherwise 2nd req in list can be send before the 1fst one
        time.sleep(0.010)


@when(
    "{number_of_requests:Int} requests are sent to {host} {path} through Lunar Proxy with {header_name} header set to {header_value}"
)
@when(
    "{number_of_requests:Int} requests are sent to {host} {path} through {proxy_id:Proxy} Shared Lunar Proxy with {header_name} header set to {header_value}"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    host: str,
    path: str,
    number_of_requests: int,
    header_name: str,
    header_value: str,
    proxy_id: str = DEFAULT_LUNAR_PROXY_ID,
):
    context.responses = context.responses if hasattr(context, "responses") else []
    for _ in range(number_of_requests):
        context.responses.append(
            await make_request(
                host,
                path,
                is_proxified=True,
                header_key=header_name,
                header_value=header_value,
                proxy_id=proxy_id,
            )
        )


@when("wait {time_to_wait:Float} seconds")
@async_run_until_complete
async def step_impl(_: Any, time_to_wait: float):
    time.sleep(time_to_wait)


# This step helps with dynamically sleeping the amount of time required
# until a next epoch-based window starts.
@when("next epoch-based {window_size:Int} seconds window arrives")
@async_run_until_complete
async def step_impl(_: Any, window_size: int):
    seconds_since_epoch = time.time()
    # the next equation is not redundant - it is used for flooring purposes
    current_window_start_time = (seconds_since_epoch / window_size) * window_size
    next_window_start_time = current_window_start_time + window_size
    seconds_till_next_window = next_window_start_time - seconds_since_epoch
    time.sleep(seconds_till_next_window)


@then("Responses have {statuses:ListOfInt} status codes in order")
@async_run_until_complete
async def step_impl(context: Any, statuses: list[int]):
    assert len(context.responses) == len(statuses)
    actual_statuses = []

    for index, status in enumerate(statuses):
        actual_statuses.append(
            context.responses[index].status,
        )

    print(f"Actual statuses: {actual_statuses}")

    for index, status in enumerate(statuses):
        assert (
            context.responses[index].status == status
        ), f"Response #{index + 1}: Expected status {status} but got {context.responses[index].status}"


def _build_remedy(
    allowed_requests: int,
    time_window: int,
    group_by: str = None,
    quota_allocations: list[QuotaAllocation] = None,
    default: DefaultBehavior = None,
    default_allocation_percentage: float = None,
    remedy_name: str = "test",
    spillover_enabled: bool = False,
):
    remedy = {
        "name": f"{remedy_name} {uuid.uuid4()}",
        "enabled": True,
        "config": {
            "strategy_based_throttling": {
                "allowed_request_count": allowed_requests,
                "window_size_in_seconds": time_window,
            }
        },
    }

    if quota_allocations is not None:
        remedy["config"]["strategy_based_throttling"]["group_quota_allocation"] = {
            "group_by": {"header_name": group_by},
            "groups": [
                {
                    "group_header_value": quota_allocation.value,
                    "allocation_percentage": quota_allocation.allocation_percentage,
                }
                for quota_allocation in quota_allocations
            ],
        }

    remedy["config"]["strategy_based_throttling"]["spillover_config"] = {
        "enabled": spillover_enabled,
        "renew_on_day": 0,
    }

    return remedy
