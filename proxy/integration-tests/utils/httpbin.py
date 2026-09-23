from toolkit_testing.integration_tests.routing import Routing
from toolkit_testing.integration_tests.healthcheck import poll_healthcheck


class HTTPBinHelper:
    def __init__(self, host: str, port: int) -> None:
        self._routing = Routing(host, port)

    async def healthcheck(self, retries: int, sleep_s: float) -> bool:
        return await poll_healthcheck(
            routing=self._routing,
            path="/base64/SFRUUEJJTiBpcyBhd2Vzb21l",
            retries=retries,
            sleep_s=sleep_s,
            body_predicate=lambda body: body == "HTTPBIN is awesome",
            status_predicate=lambda status: status == 200,
        )
