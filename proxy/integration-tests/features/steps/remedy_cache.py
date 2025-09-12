# type: ignore

from behave import when, then
from behave.api.async_step import async_run_until_complete
from typing import Any

from utils.client import request

from toolkit_testing.integration_tests.client import ProxyClientHelper, ClientResponse

from utils.policies import PoliciesRequests, EndpointPolicy


@when(
    "policies.yaml includes caching remedy for {method} {host} {path:Path} requests for "
    + "{path_params} path_params with ttl of {ttl:Float} second, {max_record_size_bytes:Int} max record size bytes "
    + "and {max_cache_size_megabytes:Float} max cache size megabytes"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    method: str,
    host: str,
    path: str,
    path_params: str,
    ttl: float,
    max_record_size_bytes: int,
    max_cache_size_megabytes: float,
):
    policies_requests: PoliciesRequests = context.policies_requests

    remedy = _build_caching_remedy(
        method,
        host,
        path,
        ttl,
        max_record_size_bytes,
        max_cache_size_megabytes,
        path_params,
    )

    policies_requests.endpoints.append(
        EndpointPolicy(method, f"{host}{path}", remedies=[remedy])
    )


def _build_caching_remedy(
    method: str,
    host: str,
    path: str,
    ttl: float,
    max_record_size_bytes: int,
    max_cache_size_megabytes: float,
    path_params: str,
    enabled: bool = True,
):
    request_payload_path = []
    for path_param in path_params.split(","):
        request_payload_path.append({"payload_type": "path_params", "path": path_param})

    remedy = {
        "name": f"caching {method} {host}/{path}",
        "enabled": enabled,
        "config": {
            "caching": {
                "request_payload_paths": request_payload_path,
                "ttl_seconds": ttl,
                "max_record_size_bytes": max_record_size_bytes,
                "max_cache_size_megabytes": max_cache_size_megabytes,
            }
        },
    }

    return remedy


@when("1 request to endpoint {scheme}:// {host} {path:Path} is made via Lunar Proxy")
@async_run_until_complete
async def step_impl(context: Any, scheme: str, host: str, path: str):
    response = await _make_request(path=path, scheme=scheme, host=host)

    if not hasattr(context, "responses"):
        context.responses = []

    context.responses.append(response)


@then("responses {response_a_index} and {response_b_index} have {same:Same} value")
async def step_imp(
    context: Any,
    response_a_index: str,
    response_b_index: str,
    same: bool,
):
    first_response_value = context.responses[response_a_index]
    second_response_value = context.responses[response_b_index]

    if same:
        assert first_response_value == second_response_value
    else:
        assert first_response_value != second_response_value


async def _make_request(
    path: str,
    scheme: str,
    host: str,
) -> ClientResponse:
    return await request(host=host, path=path, scheme=scheme, port=8080)
