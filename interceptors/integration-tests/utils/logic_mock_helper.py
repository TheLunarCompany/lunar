from json import loads
from typing import Any
from toolkit_testing.integration_tests.healthcheck import poll_healthcheck
from toolkit_testing.integration_tests.routing import Routing
import aiohttp


class LogicMockHelper:
    def __init__(self, host: str, port: int):
        self._host = host
        self._port = port

    async def init_retry(self, attempts_count: int, retry_after_value: float) -> None:
        query_string = (
            f"attempts_count={attempts_count}&retry_after_value={retry_after_value}"
        )
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self._host}:{self._port}/anything/retry/init?{query_string}"
            ) as resp:
                res = await resp.json(content_type=None)
                print(f"init response: {res}")
                return None

    async def attempt_retry(self) -> Any:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                f"{self._host}:{self._port}/anything/retry/attempt"
            ) as resp:
                res = await resp.json()
                return res

    async def healthcheck(self, retries: int, sleep_s: float) -> bool:
        return await poll_healthcheck(
            routing=Routing(self._host, self._port),
            path="/healthcheck",
            retries=retries,
            sleep_s=sleep_s,
            body_predicate=lambda body: loads(body) == {"message": "OK"},
            status_predicate=lambda status: status == 200,
        )
