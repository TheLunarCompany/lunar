import asyncio
import logging
from typing import Dict

from tornado.web import RequestHandler, Application

from web_socket.handler import WebSocketHubHandler, DISCOVERY_EVENT


async def run():
    cache = {}
    lock = asyncio.Lock()
    app = Application(
        [
            ("/discovery", Discovery, dict(cache=cache, lock=lock)),
            ("/ui/v1/control", WebSocketHubHandler, dict(cache=cache, lock=lock)),
            ("/healthcheck", HealthCheck),
        ]
    )
    logging.basicConfig(level=logging.DEBUG)

    logger = logging.getLogger("tornado.application")
    app.logger = logger
    app.listen(8088)
    logging.info("Hub Mock Server stated")
    await asyncio.Event().wait()


class Discovery(RequestHandler):
    def initialize(self, cache: Dict[str, Dict[str, str]], lock: asyncio.Lock):
        self.cache = cache
        self.lock = lock

    async def get(self):
        async with self.lock:
            data = self.cache.get(DISCOVERY_EVENT)

        if data is None:
            data = {}

        self.set_status(200)
        self.application.logger.info(data)
        self.write(data)

        await self.flush()


class HealthCheck(RequestHandler):
    async def get(self):
        self.set_status(200)
        self.write({"status": "OK"})
        self.flush()


if __name__ == "__main__":
    asyncio.run(run())
