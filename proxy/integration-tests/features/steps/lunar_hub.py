import asyncio
from json import loads
from typing import Any

from behave import then, given
from behave.api.async_step import async_run_until_complete

from utils.consts import *
from utils.hub_client import HubClient
from utils.docker import start_service, stop_service

_hub_client = HubClient()


@then("Discovery event is sent to Lunar Hub")
@async_run_until_complete
async def step_impl(_):
    assert await _hub_client.healthcheck(retries=10, sleep_s=1)
    for _ in range(4):
        try:
            discovery_response = await _hub_client.get_discovery()
            discovery_data = loads(discovery_response.body)

            print("****- Discovery Event -****")
            print(discovery_data)
            print("********")

            payload = loads(discovery_data.get("data", {}))
            proxy_version = discovery_data.get("proxy_version", "")
            # We set the version proxy to v0.0.0 in the compose file
            if len(payload.get("endpoints", {})) > 0 and proxy_version == "v0.0.0":
                return

        except:
            pass

        await asyncio.sleep(3)
    assert False


@given("Lunar Hub Mock is up")
@async_run_until_complete
async def step_impl(_: Any):
    await stop_service(LUNAR_HUB_MOCK_SERVICE_NAME)
    await start_service(LUNAR_HUB_MOCK_SERVICE_NAME)
