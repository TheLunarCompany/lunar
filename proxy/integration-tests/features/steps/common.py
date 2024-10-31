# type: ignore
# This is since `behave` is really mistyped and all dynamic.
# Might be handled later.

from behave import given, when, then, register_type
from behave.api.async_step import async_run_until_complete
from utils.docker import start_service, stop_service, rm_service
from typing import Literal, Any

from utils.httpbin import HTTPBinHelper
from utils.consts import *
from utils.docker import build_service
from utils.helpers import healthcheck
from toolkit_testing.integration_tests.mox import MoxHelper, MoxEndpointRequest
from toolkit_testing.integration_tests.client import ClientResponse
import json
import time
from aiohttp import ClientSession

from toolkit_testing.integration_tests.docker import EnvVar

_mox_helper = MoxHelper(host="http://localhost", port=8888)
_httpbin_helper = HTTPBinHelper(host="http://localhost", port=8080)


def parse_int(text: str) -> int:
    return int(text)


def parse_list_of_int(text: str) -> list[int]:
    return [int(x) for x in text.split(",")]


def parse_float(text: str) -> float:
    return float(text)


def validate_path(path: str) -> str:
    if not path.startswith("/"):
        raise Exception(f"path must start with `/`, but received {path}")
    return path


def parse_index(text: str) -> int:
    return int(text) - 1  # Indexes in tests are 1-based but in Python they are 0-based


def parse_enabled(text: str) -> bool:
    text = text.lower()
    if text == "enabled":
        return True
    elif text == "disabled":
        return False

    raise ValueError(f"Invalid bool: {text}")


def parse_same(text: str) -> bool:
    text = text.lower()
    if text == "same":
        return True
    elif text == "different":
        return False

    raise ValueError(f"Invalid bool: {text}")


register_type(Status=parse_int)
register_type(Port=parse_int)
register_type(Int=parse_int)
register_type(ListOfInt=parse_list_of_int)
register_type(Float=parse_float)
register_type(Path=validate_path)
register_type(Index=parse_index)
register_type(Enabled=parse_enabled)
register_type(Same=parse_same)


#############################
## Environment setup steps ##
#############################


@given("API Provider is {up_or_down}")
@async_run_until_complete
async def step_impl(_, up_or_down: Literal["up"] | Literal["down"]):
    if up_or_down == "up":
        await start_service(HTTPBIN_SERVICE_NAME, [])
        await start_service(MOX_SERVICE_NAME, [])
        assert await _mox_helper.healthcheck(retries=HEALTHCHECK_RETRIES, sleep_s=1)
        assert await _httpbin_helper.healthcheck(retries=HEALTHCHECK_RETRIES, sleep_s=1)
        assert await _mox_helper.set_mox_proxy_path(MOX_GET_UUID_ENDPOINT_REQUEST)
        assert await _mox_helper.set_mox_proxy_path(MOX_GET_UNMATCHED_ENDPOINT_REQUEST)
    else:
        await stop_service(HTTPBIN_SERVICE_NAME)
        await stop_service(MOX_SERVICE_NAME)


@given("Lunar Proxy env var `{env_var}` set to `{value}`")
def step_impl(context: Any, env_var: str, value: str):
    context.lunar_proxy_env_vars.append(EnvVar(env_var, value))


@given("Lunar Proxy is up")
@async_run_until_complete
async def step_impl(context: Any):
    await start_proxy(context)


@given("Lunar Proxy is down")
@then("Lunar Proxy is down")
@async_run_until_complete
async def step_impl(_: Any):
    await stop_proxy()


#######################
## General mox steps ##
#######################


@given("mox is set to respond to {method} {path:Path} with status {code:Status}")
@async_run_until_complete
async def step_impl(context: Any, method: str, path: str, code: int):
    endpoint_id = await _mox_helper.set_mox_proxy_path(
        MoxEndpointRequest(method, path, "{}", code, {})
    )
    context.created_mox_endpoint_ids.append(endpoint_id)


#####################################
## General local-HTTP client steps ##
#####################################


@when(
    "A local {method} request (id {request_id}) is made to port {port:Port} at path {path:Path}"
)
@async_run_until_complete
async def step_impl(context: Any, method: str, request_id: str, port: int, path: str):
    start_time = time.time()
    url = f"http://localhost:{port}{path}"
    async with ClientSession() as session:
        try:
            async with session.request(method=method, url=url) as resp:
                status = resp.status
                resp_body = await resp.text()
                response_time = time.time()
                runtime_s = response_time - start_time
                context.local_responses[request_id] = ClientResponse(
                    resp_body, status, response_time=response_time, runtime_s=runtime_s
                )
                print(f"response: {context.local_responses[request_id]}")
                return
        except Exception as ex:
            print(f"failed calling {url}: {ex}")
            return


@then("Response (id {request_id}) status code should be {status:Status}")
def step_impl(context: Any, request_id: str, status: int):
    print(f"context: {context.local_responses}")
    assert context.local_responses[request_id].status == status


############################################
## General proxified responses assertions ##
############################################


@then("Response has status {status:Int}")
@async_run_until_complete
async def step_impl(context: Any, status: int):
    print(f"context.proxified_response: {context.proxified_response}")
    assert context.proxified_response.status == status


@then("Response has {header_name} header")
@async_run_until_complete
async def step_impl(context: Any, header_name: str):
    print(f"Response headers: {context.proxified_response.headers}")
    assert context.proxified_response.headers.get(header_name, None) is not None


@then("Response does not have {header_name} header")
@async_run_until_complete
async def step_impl(context: Any, header_name: str):
    print(f"Response headers: {context.proxified_response.headers}")
    assert not header_name in context.proxified_response.headers


@then("Responses does not have {header_name} header")
@async_run_until_complete
async def step_impl(context: Any, header_name: str):
    for response in context.responses:
        print(f"Response headers: {response.headers}")
        assert header_name not in response.headers


@then("Response has {header_name} header with value {header_value}")
@async_run_until_complete
async def step_impl(context: Any, header_name: str, header_value: str):
    print(f"Response headers: {context.proxified_response.headers}")
    assert header_name in context.proxified_response.headers
    print(
        f"Found header {context.proxified_response.headers[header_name]} but expected {header_value}"
    )
    assert context.proxified_response.headers[header_name] == header_value


######################################
## JSON Traversal & Assertion Steps ##
######################################


@then(
    "item {marked_object} is an array with item that matches {raw_json} (marked as {marker})"
)
@async_run_until_complete
async def step_impl(context: Any, marked_object: str, raw_json: str, marker: str):
    print(f"context.marked_objects: {context.marked_objects}")
    array = context.marked_objects[marked_object]
    assert array
    found_item = next(
        item for item in array if json.loads(raw_json).items() <= item.items()
    )
    assert found_item
    context.marked_objects[marker] = found_item


@then("item {marker} {field} json is {value}")
@async_run_until_complete
async def step_impl(context: Any, marker: str, field: str, value: str):
    print(f"context.marked_objects: {context.marked_objects}")
    assert context.marked_objects[marker]
    assert context.marked_objects[marker][field] == json.loads(value)


@then("item {marker} {field} is {value}")
@async_run_until_complete
async def step_impl(context: Any, marker: str, field: str, value: str):
    print(f"context.marked_objects: {context.marked_objects}")
    assert context.marked_objects[marker]
    assert str(context.marked_objects[marker][field]) == value


@then("item {marked_object} has field {field} (marked {marker})")
@async_run_until_complete
async def step_impl(context: Any, marked_object: str, field: str, marker: str):
    print(f"context.marked_objects: {context.marked_objects}")
    item = context.marked_objects[marked_object]
    assert item
    found_field = item[field]
    assert found_field
    context.marked_objects[marker] = found_field


async def stop_proxy():
    try:
        await stop_service(LUNAR_PROXY_SERVICE_NAME)
        await rm_service(LUNAR_PROXY_SERVICE_NAME)
    except Exception as exc:
        print(exc)


async def start_proxy(
    context: Any, proxy_service: str = LUNAR_PROXY_SERVICE_NAME, port: str = 8040
):
    await build_service(proxy_service, [], [])
    await start_service(proxy_service, context.lunar_proxy_env_vars)

    await healthcheck(
        method="GET",
        url=f"http://localhost:{port}/healthcheck",
        status_predicate=lambda status: status == 200,
        attempts=20,
        sleep_s=0.5,
    )
