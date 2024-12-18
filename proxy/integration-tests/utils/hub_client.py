from json import loads
from toolkit_testing.integration_tests.healthcheck import poll_healthcheck
from toolkit_testing.integration_tests.routing import Routing
from toolkit_testing.integration_tests.client import ProviderClientHelper

_ROUTING = Routing("http://localhost", 8088)


class HubClient:
    def __init__(self):
        self._client_helper = ProviderClientHelper()

    async def get_discovery(self):
        return await self._client_helper.make_request(_ROUTING, "/discovery")

    async def get_configuration_load(self):
        return await self._client_helper.make_request(_ROUTING, "/configuration_load")

    async def healthcheck(self, retries: int, sleep_s: float) -> bool:
        return await poll_healthcheck(
            routing=_ROUTING,
            path="/healthcheck",
            retries=retries,
            sleep_s=sleep_s,
            body_predicate=lambda body: loads(body) == {"status": "OK"},
            status_predicate=lambda status: status == 200,
        )
