# type: ignore

from behave import then
from behave.api.async_step import async_run_until_complete
from json import loads
from typing import Any

from toolkit_testing.integration_tests.mox import MoxEndpointRequest
from steps.common_steps import (
    MOX_GET_UUID_ENDPOINT_RESPONSE,
    MOX_GET_UUID_ENDPOINT_STATUS,
    mox_helper,
)

_LUNAR_SEQUENCE_ID_HEADER_NAME = "x-lunar-sequence-id"

_MOX_GET_ENDPOINT_WITH_X_LUNAR_SEQ_ID = MoxEndpointRequest(
    verb="GET",
    path="/uuid",
    headers={_LUNAR_SEQUENCE_ID_HEADER_NAME: "123"},
    return_value=MOX_GET_UUID_ENDPOINT_RESPONSE,
    status_code=MOX_GET_UUID_ENDPOINT_STATUS,
)


@given(f"Lunar proxy returns responses with {_LUNAR_SEQUENCE_ID_HEADER_NAME} header")
@async_run_until_complete
async def step_impl(_: Any):
    assert await mox_helper.set_mox_proxy_path(_MOX_GET_ENDPOINT_WITH_X_LUNAR_SEQ_ID)


@then(f"response will not contain the header {_LUNAR_SEQUENCE_ID_HEADER_NAME}")
@async_run_until_complete
async def step_impl(context: Any):
    assert loads(context.body) == loads(MOX_GET_UUID_ENDPOINT_RESPONSE)
    assert context.status == MOX_GET_UUID_ENDPOINT_STATUS
    assert _LUNAR_SEQUENCE_ID_HEADER_NAME not in context.headers
