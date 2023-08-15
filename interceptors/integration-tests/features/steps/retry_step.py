# type: ignore
from json import loads
from typing import Any

from behave import then
from behave.api.async_step import async_run_until_complete

from steps.common_steps import logic_mock_helper


@given(
    "Lunar Proxy (logic support) will return `x-lunar-retry-after` header with value `{retry_after:Float}` for {times:Int} times"
)
@async_run_until_complete
async def step_impl(_: Any, retry_after: float, times: int):
    await logic_mock_helper.init_retry(
        attempts_count=times, retry_after_value=retry_after
    )


@then(
    "Lunar proxy (logic support) should have receive a total of {call_count:Int} calls"
)
@async_run_until_complete
async def step_impl(context: Any, call_count: int):
    body = loads(context.body)
    print(f"body: {body}")
    assert body["retry_state"]["call_count"] == call_count


@then(
    "total sequence time should be around {runtime:Float} seconds (with a delta of ~ {delta:Float} seconds)"
)
@async_run_until_complete
async def step_impl(context: Any, runtime: float, delta: float):
    body = loads(context.body)
    print(f"body: {body}")
    seconds_since_first_call = float(body["ms_since_first_call"]) / 1000
    floor = runtime - delta
    ceil = runtime + delta
    assert floor < seconds_since_first_call < ceil
