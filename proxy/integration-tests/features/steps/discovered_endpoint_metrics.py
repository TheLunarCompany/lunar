# type: ignore

import json
from typing import Any

from behave import when, then, register_type
from behave.api.async_step import async_run_until_complete

from utils.helpers import retry_async, parse_int
from utils.client import extract_scheme

from toolkit_testing.integration_tests.docker import read_file
from toolkit_testing.integration_tests.client import ProxyClientHelper
from toolkit_testing.integration_tests.routing import Routing
from toolkit_testing.integration_tests.routing import Routing
from toolkit_testing.integration_tests.mox import MoxHelper, MoxEndpointRequest

_mox_helper = MoxHelper(host="http://localhost", port=8888)

_LUNAR_PROXY = "lunar-proxy"
_DISCOVERED_ENDPOINT_DIRECTORY = "/etc/fluent-bit/plugin"
_DISCOVERED_ENDPOINT_FILE = "discovery-aggregated-state.json"

_proxy_client_helper = ProxyClientHelper(proxy_host="http://localhost", proxy_port=8000)


def load_json(text: str) -> dict[int, int]:
    return eval(text)


register_type(Int=parse_int)
register_type(Json=load_json)


@when(
    "{count:Int} requests to {method} {scheme}:// {host} :{port:Int} {path:Path} are made through Lunar Proxy with headers {headers:Json}"
)
@async_run_until_complete
async def step_impl(
    _: Any,
    count: int,
    method: str,
    scheme: str,
    host: str,
    port: int,
    path: str,
    headers: dict[str, str] | None = None,
):
    for _ in range(count):
        await _proxy_client_helper.make_request(
            Routing(
                requested_host=host,
                requested_scheme=extract_scheme(scheme),
                requested_port=port,
            ),
            path=path,
            method=method,
            headers=headers,
        )


@when("mox is set to return status code {status_code:Int} on {method} {path}")
@async_run_until_complete
async def step_impl(context: Any, status_code: int, method: str, path: str):
    mox_endpoint_request = build_mox_endpoint_request(
        method=method, path=path, status_code=status_code
    )
    if hasattr(context, "mox_endpoint_id"):
        await _mox_helper.update_mox_proxy_path(
            context.mox_endpoint_id, mox_endpoint_request
        )
    else:
        context.mox_endpoint_id = await _mox_helper.set_mox_proxy_path(
            mox_endpoint_request
        )

    print(f"mox_endpoint_request:\n{mox_endpoint_request}")


def build_mox_endpoint_request(
    method: str, path: str, status_code: int
) -> MoxEndpointRequest:
    return MoxEndpointRequest(
        verb=method,
        path=path,
        return_value="{}",
        status_code=status_code,
        headers={},
    )


@then(
    "Discovered consumer metrics for {method} {host} {path:Path} has consumer {expected_consumer} with requests ({expected_requests:Json})"
)
@async_run_until_complete
async def step_impl(
    _: Any,
    method: str,
    host: str,
    path: str,
    expected_consumer: str,
    expected_requests: dict[str, str],
):
    content = await _get_discovery_data()
    assert content is not None

    discovered = json.loads(content)
    discovered_consumers = discovered["consumers"]

    print(f"discovered_consumers_metrics: {discovered_consumers}")

    endpoint_key = _build_endpoint_key(method, host, path)
    for expected_status, expected_count in expected_requests.items():
        assert (
            discovered_consumers[expected_consumer][endpoint_key]["status_codes"][
                expected_status
            ]
            == expected_count
        )


@then(
    "Discovered endpoint metrics for {method} {host} {path:Path} has {expected_total:Int} requests ({expected_status_map:Json})"
)
@async_run_until_complete
async def step_impl(
    _: Any,
    method: str,
    host: str,
    path: str,
    expected_total: int,
    expected_status_map: dict[str, int],
):
    async def run():
        content = await _get_discovery_data()
        assert content is not None

        discovered = json.loads(content)
        discovered_endpoint_metrics = discovered["endpoints"]

        print(f"discovered_endpoint_metrics: {discovered_endpoint_metrics}")
        endpoint_key = _build_endpoint_key(method, host, path)
        assert discovered_endpoint_metrics[endpoint_key]["count"] == expected_total
        for status, count in expected_status_map.items():
            assert (
                discovered_endpoint_metrics[endpoint_key]["status_codes"][status]
                == count
            )

    await retry_async(
        f=run, name="assert_endpoint_metrics_from_file", attempts=10, sleep_s=1
    )


@then(
    "Discovered interceptor metrics has {expected_total:Int} interceptors ({expected_interceptors_map:Json})"
)
@async_run_until_complete
async def step_impl(
    _: Any,
    expected_total: int,
    expected_interceptors_map: dict[str, str],
):
    async def run():
        content = await _get_discovery_data()
        assert content is not None

        discovered = json.loads(content)
        discovered_interceptor_metrics = discovered["interceptors"]

        print(f"discovered_interceptor_metrics: {discovered_interceptor_metrics}")
        assert len(discovered_interceptor_metrics) == expected_total
        for metric in discovered_interceptor_metrics:
            assert expected_interceptors_map.get(metric["type"]) == metric["version"]

    await retry_async(
        f=run, name="assert_interceptor_metrics_from_file", attempts=10, sleep_s=1
    )


async def _get_discovery_data():
    return await read_file(
        _LUNAR_PROXY, _DISCOVERED_ENDPOINT_DIRECTORY, _DISCOVERED_ENDPOINT_FILE
    )


def _build_endpoint_key(method: str, host: str, path: str):
    return f"{method}:::{host}{path}"
