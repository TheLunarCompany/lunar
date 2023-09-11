# type: ignore
# This is since `behave` is really mistyped and all dynamic.
# Might be handled later.
import re
from time import sleep
from json import dumps, loads
from typing import Any, Literal
from behave import given, when, then, register_type
from behave.api.async_step import async_run_until_complete

from utils.docker import start_service, stop_service, build_service
from features.environment import (
    MOX_SERVICE_NAME,
    CLIENT_SERVICE_NAME,
    LOGIC_MOCK_SERVER_SERVICE_NAME,
    mox_helper,
    logic_mock_helper,
)
from utils.consumer_client import MoxConsumerClient
from utils.logic_mock_consumer_client import LogicMockConsumerClient
from toolkit_testing.integration_tests.docker import EnvVar
from toolkit_testing.integration_tests.mox import MoxEndpointRequest

_ERROR_HEADER_KEY = "x-lunar-error"

MOX_GET_UUID_ENDPOINT_RESPONSE = dumps(loads('{"uuid": "fake_uuid_from_proxy"}'))
MOX_GET_UUID_ENDPOINT_STATUS = 200

_MOX_GET_UUID_ENDPOINT_REQUEST = MoxEndpointRequest(
    verb="GET",
    path="/uuid",
    return_value=MOX_GET_UUID_ENDPOINT_RESPONSE,
    status_code=MOX_GET_UUID_ENDPOINT_STATUS,
)

_MOX_GET_BAD_ENDPOINT_REQUEST = MoxEndpointRequest(
    verb="GET",
    path="/anything/bad_url",
    headers={_ERROR_HEADER_KEY: "1"},
    return_value=MOX_GET_UUID_ENDPOINT_RESPONSE,
    status_code=MOX_GET_UUID_ENDPOINT_STATUS,
)

_MOX_GET_DICT_ENDPOINTS = {
    "valid": _MOX_GET_UUID_ENDPOINT_REQUEST,
    "invalid": _MOX_GET_BAD_ENDPOINT_REQUEST,
}


_mox_consumer_client = MoxConsumerClient()
_logic_mock_consumer_client = LogicMockConsumerClient()

register_type(Int=int)
register_type(Float=float)


@given("export {env_var}={value}")
def step_impl(context: Any, env_var: str, value: str | int):
    context.env_values.append(EnvVar(env_var, str(value)))


@given("client application is running")
@async_run_until_complete
async def step_impl(context: Any):
    await build_service(CLIENT_SERVICE_NAME, context.build_args, context.env_values)
    await stop_service(CLIENT_SERVICE_NAME, context.env_values)
    await start_service(CLIENT_SERVICE_NAME, context.env_values)


@when("{time_to_wait:Int} seconds pass")
def step_impl(_: Any, time_to_wait: int):
    sleep(time_to_wait)


@given("Lunar Proxy is {up_or_down}")
@async_run_until_complete
async def step_impl(context: Any, up_or_down: Literal["up"] | Literal["down"]):
    await bring_proxy_up_or_down(context, up_or_down, "static", context.env_values)


@given("Lunar Proxy (logic support) is {up_or_down}")
@async_run_until_complete
async def step_impl(context: Any, up_or_down: Literal["up"] | Literal["down"]):
    await bring_proxy_up_or_down(context, up_or_down, "logic", context.env_values)


async def bring_proxy_up_or_down(
    context: Any,
    up_or_down: Literal["up"] | Literal["down"],
    kind: Literal["static"] | Literal["logic"],
    env_values: list[EnvVar],
):
    match kind:
        case "static":
            service_name = MOX_SERVICE_NAME
            helper = mox_helper
        case "logic":
            service_name = LOGIC_MOCK_SERVER_SERVICE_NAME
            await build_service(service_name, context.build_args, context.env_values)
            helper = logic_mock_helper

    if up_or_down == "up":
        await start_service(service_name, env_values)
        assert await helper.healthcheck(retries=10, sleep_s=1)
    else:
        await stop_service(service_name, env_values)


@given("Mox path {valid_or_invalid} endpoint is set")
@async_run_until_complete
async def step_impl(_: Any, valid_or_invalid: Literal["valid"] | Literal["invalid"]):
    assert await mox_helper.set_mox_proxy_path(
        _MOX_GET_DICT_ENDPOINTS[valid_or_invalid]
    )


@when("client application makes an outgoing HTTP call")
@async_run_until_complete
async def step_impl(context):
    assert await _mox_consumer_client.healthcheck(retries=10, sleep_s=1)
    trigger_response = await _mox_consumer_client.call_trigger()
    print("****- call_trigger -****")
    print(trigger_response)
    print("********")
    context.body = trigger_response.body
    context.status = trigger_response.status
    context.headers = trigger_response.headers


@when(
    "client application makes an outgoing HTTP request and retrieves the incoming request's HTTP headers"
)
@async_run_until_complete
async def step_impl(context):
    assert await _mox_consumer_client.healthcheck(retries=10, sleep_s=1)
    trigger_response = await _mox_consumer_client.call_trigger_headers()
    print("****- call_trigger_headers -****")
    print(trigger_response)
    print("********")
    context.body = trigger_response.body
    context.status = trigger_response.status


@when("client application makes an outgoing HTTP call to bad URL")
@async_run_until_complete
async def step_impl(_):
    assert await _mox_consumer_client.healthcheck(retries=10, sleep_s=1)
    resp = await _mox_consumer_client.call_trigger_bad_url()
    print("****- call_trigger_bad_url -****")
    print(resp)
    print("********")


@when("client application makes an outgoing HTTP call to internal IP")
@async_run_until_complete
async def step_impl(context):
    assert await _mox_consumer_client.healthcheck(retries=10, sleep_s=1)
    trigger_response = await _mox_consumer_client.call_trigger_local()
    context.body = trigger_response.body
    context.status = trigger_response.status


@when("client application makes an outgoing HTTP call to retryable endpoint")
@async_run_until_complete
async def step_impl(context):
    assert await _logic_mock_consumer_client.healthcheck(retries=10, sleep_s=1)
    trigger_response = await _logic_mock_consumer_client.call_trigger_retry()
    print("****- call_trigger -****")
    print(trigger_response)
    print("********")
    context.body = trigger_response.body
    context.status = trigger_response.status
    context.headers = trigger_response.headers


@then("response will return from Lunar Proxy")
def step_impl(context):
    print("**** response will return from Lunar Proxy ****")
    print(f"client: {context.body}")

    print(f"mox: {MOX_GET_UUID_ENDPOINT_RESPONSE}")
    print("**** response will return from Lunar Proxy ****")
    assert loads(context.body) == loads(MOX_GET_UUID_ENDPOINT_RESPONSE)
    assert context.status == MOX_GET_UUID_ENDPOINT_STATUS


@then("response will return from original provider")
def step_impl(context):
    import uuid

    print("********")
    print(context.body)
    print("********")
    try:
        uuid.UUID(str(loads(context.body)["uuid"]))
        assert True
    except ValueError:
        assert False
    assert context.status == 200


@then("response will return from Lunar Proxy with incoming request's HTTP headers.")
@async_run_until_complete
async def step_impl(context):
    pattern = r"lunar-(java|aiohttp)-interceptor/\d+\.\d+\.\d+"
    lunar_interceptor = loads(context.body)["headers"]["x-lunar-interceptor"]
    print("********")
    print(lunar_interceptor)
    print("********")
    assert re.fullmatch(pattern, lunar_interceptor)
