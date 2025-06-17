# type: ignore
import asyncio

from behave import then, when, register_type
from behave.api.async_step import async_run_until_complete

import uuid
import random
import json
import time
import math

from typing import Any
from dataclasses import dataclass

from utils.client import make_request
from utils.consts import DEFAULT_LUNAR_PROXY_ID
from utils.policies import EndpointPolicy, PoliciesRequests
from toolkit_testing.integration_tests.client import ClientResponse


def parse_priority_list(text: str) -> list[str]:
    return [x.strip() for x in text.split(">")]


register_type(PriorityList=parse_priority_list)


@when(
    "policies.yaml includes a strategy_based_queue remedy for {method} {host} {path} requests with {allowed_requests:Int} requests per {time_window:Int} seconds and TTL of {ttl_seconds:Float} seconds and queue_size of {queue_size:Int} resulting in {response_status_code:Int} status code"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    method: str,
    host: str,
    path: str,
    allowed_requests: int,
    time_window: int,
    ttl_seconds: float,
    queue_size: int,
    response_status_code: int,
):
    policies_requests: PoliciesRequests = context.policies_requests
    remedy = _build_remedy(
        allowed_requests, time_window, ttl_seconds, queue_size, response_status_code
    )
    policies_requests.endpoints.append(
        EndpointPolicy(method, f"{host}{path}", remedies=[remedy])
    )
    context.window_size = time_window


@when(
    "policies.yaml includes a strategy_based_queue remedy for {method} {host} {path} requests with {allowed_requests:Int} requests per {time_window:Int} seconds and TTL of {ttl_seconds:Float} seconds and queue_size of {queue_size:Int} resulting in {response_status_code:Int} status code with prioritization of {priority_list:PriorityList} by header {priority_header_name}"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    method: str,
    host: str,
    path: str,
    allowed_requests: int,
    time_window: int,
    ttl_seconds: float,
    queue_size: int,
    response_status_code: int,
    priority_list: list[str],
    priority_header_name: str,
):
    policies_requests: PoliciesRequests = context.policies_requests
    prioritization = Prioritization(priority_list, priority_header_name)
    remedy = _build_remedy(
        allowed_requests,
        time_window,
        ttl_seconds,
        queue_size,
        response_status_code,
        prioritization,
    )
    policies_requests.endpoints.append(
        EndpointPolicy(method, f"{host}{path}", remedies=[remedy])
    )
    context.window_size = time_window


@when(
    "{number_of_requests:Int} requests are sent in parallel to httpbinmock {path} through Lunar Proxy"
)
@when(
    "{number_of_requests:Int} requests are sent in parallel to httpbinmock {path} through {proxy_id:Proxy} Shared Lunar Proxy"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    number_of_requests: int,
    path: str,
    proxy_id: str = DEFAULT_LUNAR_PROXY_ID,
):
    tasks = [
        make_request("httpbinmock", path, True, proxy_id=proxy_id)
        for _ in range(number_of_requests)
    ]
    context.start_time = time.time()
    context.responses = sorted(
        await asyncio.gather(*tasks), key=lambda resp: resp.runtime_s
    )


@then(
    "{number_of_requests:Int} requests returning with status {status:Int} and {number_of_requests2:Int} with {status2:Int}"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    number_of_requests: int,
    status: str,
    status2: int,
    number_of_requests2: int,
):
    response_results = {status: 0, status2: 0}

    all_responses: list[ClientResponse] = context.responses
    for _, response in enumerate(all_responses):
        response_results[response.status] += 1

    print(f"response_results: {response_results}")

    assert response_results[status] == number_of_requests
    assert response_results[status2] == number_of_requests2


@when(
    "{number_of_requests:Int} requests are sent in parallel to httpbinmock {path} through Lunar Proxy, {specified_priority_count:Int} with {header_name} header {specified_priority} and the rest {default_priority}"
)
@when(
    "{number_of_requests:Int} requests are sent in parallel to httpbinmock {path} through {proxy_id:Proxy} Shared Lunar Proxy, {specified_priority_count:Int} with {header_name} header {specified_priority} and the rest {default_priority}"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    number_of_requests: int,
    path: str,
    specified_priority_count: int,
    header_name: str,
    specified_priority: str,
    default_priority: str,
    proxy_id: str = DEFAULT_LUNAR_PROXY_ID,
):
    tasks = []
    for i in range(number_of_requests):
        priority = (
            specified_priority if i < specified_priority_count else default_priority
        )
        tasks.append(
            make_request(
                "httpbinmock",
                path,
                True,
                header_key=header_name,
                header_value=priority,
                proxy_id=proxy_id,
            )
        )

    # shuffling the list ensures order doesn't matter
    random.shuffle(tasks)

    context.start_time = time.time()
    context.responses = sorted(
        await asyncio.gather(*tasks), key=lambda resp: resp.runtime_s
    )


@then(
    "requests {indexes:ListOfInt} are performed within window {window:Int} returning status {status:Int}"
)
@async_run_until_complete
async def step_impl(context: Any, indexes: list[int], window: int, status: int):
    all_responses: list[ClientResponse] = context.responses
    start_time = math.floor(context.start_time)

    epoch_time = math.floor(time.time())

    elapsed_time = start_time - epoch_time

    # Calculate the number of whole windows that have passed
    num_windows = elapsed_time // context.window_size

    # Calculate the current window start time
    first_window_start_time = epoch_time + (num_windows * context.window_size)

    target_window_start_time = first_window_start_time + (
        (window - 1) * context.window_size
    )
    target_window_end_time = first_window_start_time + (window * context.window_size)

    print(f"target_window_start_time: {target_window_start_time}")
    print(f"target_window_end_time: {target_window_end_time}")
    relevant_responses = [all_responses[i - 1] for i in indexes]
    print(
        f"asserting on responses {indexes}: {[[response.response_time, response.runtime_s, response.status] for response in relevant_responses]}, start_window: {math.floor(context.start_time)}, start_time: {context.start_time}"
    )
    for _, response in enumerate(relevant_responses):
        assert (
            target_window_start_time < response.response_time < target_window_end_time
        )
        assert response.status == status


@then(
    "requests {indexes:ListOfInt} are performed within {min_seconds:Float} to {max_seconds:Float} seconds returning status {status:Int}"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    indexes: list[int],
    min_seconds: float,
    max_seconds: float,
    status: int,
):
    all_responses: list[ClientResponse] = context.responses

    # add 10% buffer on times for stability
    min_seconds = min_seconds * 0.9
    max_seconds = max_seconds * 1.1

    relevant_responses = [all_responses[i - 1] for i in indexes]
    print(
        f"asserting on responses {indexes}: {[[response.response_time, response.runtime_s, response.status] for response in relevant_responses]}, start_window: {math.floor(context.start_time)}, start_time: {context.start_time}"
    )
    for _, response in enumerate(relevant_responses):
        assert min_seconds < response.runtime_s < max_seconds
        assert response.status == status


@then("requests have at least {expected:Int} value: {header_key}={header_value} header")
@async_run_until_complete
async def step_impl(context: Any, expected: int, header_value: str, header_key: str):
    all_responses: list[ClientResponse] = context.responses
    header_found = 0
    for _, response in enumerate(all_responses):
        got = json.loads(response.body)["headers"][header_key]
        print(f"!!! expecting {header_key}: {header_value} ::: got: {got}")
        if json.loads(response.body)["headers"][header_key] != header_value:
            continue

        header_found += 1

    print(f"header_found: {header_found}, expected: {expected}")
    assert header_found >= expected


@then("requests {indexes:ListOfInt} have {header_value} {header_name} header")
@async_run_until_complete
async def step_impl(
    context: Any, indexes: list[int], header_value: str, header_name: str
):
    all_responses: list[ClientResponse] = context.responses

    relevant_responses = [all_responses[i - 1] for i in indexes]
    print(
        f"asserting on responses {indexes}: {[[response.runtime_s, response.body] for response in relevant_responses]}"
    )
    print(
        f"all_responses: {[json.loads(res.body)['headers'][header_name] for res in all_responses]}"
    )
    for _, response in enumerate(relevant_responses):
        got = json.loads(response.body)["headers"][header_name]
        print(f"!!! expecting {header_name}: {header_value} ::: got: {got}")
        assert json.loads(response.body)["headers"][header_name] == header_value


@dataclass
class Prioritization:
    priority_list: list[str]
    priority_header_name: str


def _build_remedy(
    allowed_requests: int,
    time_window: int,
    ttl_seconds: float,
    queue_size: int,
    response_status_code: int,
    prioritization: Prioritization | None = None,
    remedy_name: str = "test",
):
    # buffer up TTL by 10% for stability
    ttl_seconds = ttl_seconds * 1.1
    remedy = {
        "name": f"{remedy_name} {uuid.uuid4()}",
        "enabled": True,
        "config": {
            "strategy_based_queue": {
                "allowed_request_count": allowed_requests,
                "window_size_in_seconds": time_window,
                "response_status_code": response_status_code,
                "ttl_seconds": ttl_seconds,
                "queue_size": queue_size,
            }
        },
    }

    if prioritization is not None:
        groups = {
            item: {"priority": index}
            for index, item in enumerate(prioritization.priority_list)
        }
        prioritization_config = {
            "group_by": {"header_name": prioritization.priority_header_name},
            "groups": groups,
        }

        remedy["config"]["strategy_based_queue"][
            "prioritization"
        ] = prioritization_config

    return remedy
