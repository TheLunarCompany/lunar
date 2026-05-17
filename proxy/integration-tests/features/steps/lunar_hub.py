# type: ignore

import asyncio
from json import loads
from typing import Any

from behave import then, given
from behave.api.async_step import async_run_until_complete
from prometheus_client.parser import text_string_to_metric_families

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

            payload = discovery_data.get("data", {})
            if len(payload.get("endpoints", {})) > 0:
                return

        except Exception as e:
            pass

        await asyncio.sleep(3)
    assert False


@then("Metrics event is sent to Lunar Hub")
@async_run_until_complete
async def step_impl(_):
    assert await _hub_client.healthcheck(retries=10, sleep_s=1)
    for _ in range(6):
        try:
            metrics_response = await _hub_client.get_metrics()
            metrics_data = loads(metrics_response.body)

            print("****- Metrics Event -****")
            print(metrics_data)
            print("********")

            payload = metrics_data.get("data", {})
            if len(payload) > 0:
                metrics_counter = count_metrics(metrics_data.get("data", {}))
                if metrics_counter:
                    return

        except Exception as e:
            pass

        await asyncio.sleep(3)
    assert False


@then("Configuration Load event is sent to Lunar Hub")
@async_run_until_complete
async def step_impl(_):
    assert await _hub_client.healthcheck(retries=10, sleep_s=1)
    for _ in range(4):
        try:
            configuration_load_response = await _hub_client.get_configuration_load()
            configuration_load_data = loads(configuration_load_response.body)

            print("****- Configuration Load -****")
            print(configuration_load_data)
            print("********")

            payload = configuration_load_data.get("data", {})
            if (
                len(payload.get("data", {})) > 0
            ):  # schema has `data` key, an array, in top level `data` field,
                return

        except Exception as e:
            pass

        await asyncio.sleep(3)
    assert False


@given("Lunar Hub Mock is down")
@async_run_until_complete
async def step_impl(_: Any):
    await stop_service(LUNAR_HUB_MOCK_SERVICE_NAME)


@given("Lunar Hub Mock is up")
@async_run_until_complete
async def step_impl(_: Any):
    await stop_service(LUNAR_HUB_MOCK_SERVICE_NAME)
    await start_service(LUNAR_HUB_MOCK_SERVICE_NAME)


def count_metrics(metrics_text, prefix=None):
    metric_counts = {}

    # Parse the metrics text
    for family in text_string_to_metric_families(metrics_text):
        metric_name = family.name
        if prefix and not metric_name.startswith(prefix):
            continue  # Skip metrics that don't match the prefix

        metric_counts[metric_name] = len(family.samples)

    return metric_counts