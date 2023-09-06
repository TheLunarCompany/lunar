from json import loads
from toolkit_testing.integration_tests.healthcheck import poll_healthcheck
from toolkit_testing.integration_tests.routing import Routing
from toolkit_testing.integration_tests.client import ProviderClientHelper

_ROUTING = Routing("http://localhost", 8080)


# This client helps with making proxified calls to endpoints which requires
# heavier logic than mox can supply, such as retry protocol
class LogicMockConsumerClient:
    def __init__(self):
        self._client_helper = ProviderClientHelper()

    async def call_trigger_retry(self):
        return await self._client_helper.make_request(_ROUTING, "/trigger_retry")

    async def healthcheck(self, retries: int, sleep_s: float) -> bool:
        return await poll_healthcheck(
            routing=_ROUTING,
            path="/healthcheck",
            retries=retries,
            sleep_s=sleep_s,
            body_predicate=lambda body: loads(body) == {"status": "OK"},
            status_predicate=lambda status: status == 200,
        )
