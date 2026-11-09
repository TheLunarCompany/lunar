# type: ignore

import json
from typing import Any

from behave import then
from behave.api.async_step import async_run_until_complete

from utils.helpers import retry_async, parse_int
from utils.client import extract_scheme

from toolkit_testing.integration_tests.docker import read_file
from toolkit_testing.integration_tests.client import ProxyClientHelper
from toolkit_testing.integration_tests.routing import Routing
from toolkit_testing.integration_tests.routing import Routing
from toolkit_testing.integration_tests.mox import MoxHelper, MoxEndpointRequest
from utils.consts import AGGREGATIONS_DIRECTORY, REMEDY_STATS_FILE

_LUNAR_PROXY = "lunar-proxy"


@then(
    "Remedy stats metrics (marked as {marker}) gets the {action_count:Int} {action} responses out of a total of {total_count:Int} transactions"
)
@async_run_until_complete
async def step_impl(
    context: Any, marker: str, action_count: int, action: str, total_count: int
):
    async def run():
        content = await _get_remedy_stats()
        assert content is not None

        remedy_stats = json.loads(content)
        print(f"remedy_stats: {remedy_stats}")

        action_stats = remedy_stats["remedy_action_stats"][action]
        assert action_stats["count"] == action_count
        assert action_stats["count"] / action_stats["ratio"] == total_count

        context.marked_objects[marker] = remedy_stats

    await retry_async(f=run, name="assert_metrics_from_file", attempts=10, sleep_s=1)


async def _get_remedy_stats():
    return await read_file(_LUNAR_PROXY, AGGREGATIONS_DIRECTORY, REMEDY_STATS_FILE)
