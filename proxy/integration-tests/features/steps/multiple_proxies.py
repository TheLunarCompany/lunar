# type: ignore
from typing import Any

from behave import given, register_type
from behave.api.async_step import async_run_until_complete

from utils.consts import *
from features.steps.common import start_proxy, stop_proxy
from utils.docker import start_service, stop_service


def parse_proxy_id(text: str) -> bool:
    text = text.lower()
    if text == "first":
        return "1"
    elif text == "second":
        return "2"

    raise ValueError(f"Not yet supported: {text}")


register_type(Proxy=parse_proxy_id)


@given("{proxy_id:Proxy} Shared Lunar Proxy is up")
@async_run_until_complete
async def step_impl(context: Any, proxy_id: str):
    if proxy_id == "1":
        await start_proxy(context, LUNAR_PROXY_PRO_1_SERVICE_NAME, 8041, 8082)
    elif proxy_id == "2":
        await start_proxy(context, LUNAR_PROXY_PRO_2_SERVICE_NAME, 8042, 8083)


@given("{proxy_id:Proxy} Shared Lunar Proxy is down")
@async_run_until_complete
async def step_impl(context: Any, proxy_id: str):
    if proxy_id == "1":
        await stop_proxy(LUNAR_PROXY_PRO_1_SERVICE_NAME)
    elif proxy_id == "2":
        await stop_proxy(LUNAR_PROXY_PRO_2_SERVICE_NAME)


@given("Redis is up")
@async_run_until_complete
async def step_impl(_: Any):
    await stop_service(LUNAR_REDIS_SERVICE_NAME)
    await start_service(LUNAR_REDIS_SERVICE_NAME)
