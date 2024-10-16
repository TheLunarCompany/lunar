import asyncio
from tornado.log import gen_log as logger
from json import loads
from typing import Dict
from tornado.websocket import WebSocketHandler

DISCOVERY_EVENT = "discovery-event"
CONFIGURATION_LOAD_EVENT = "configuration-load-event"
EVENT_KEY = "event"
DATA_KEY = "data"
CONNECTION_READY_MESSAGE = "ready"


class WebSocketHubHandler(WebSocketHandler):
    def initialize(self, cache: Dict[str, Dict[str, str]], lock: asyncio.Lock):
        self.cache = cache
        self.lock = lock

    async def on_message(self, message: str | bytes):
        logger.info(f"Received message: {message}")
        await self.handle_message(message)

    async def handle_message(self, message: str | bytes):
        try:
            json_data = loads(message)
            logger.info(f"Parsed message: {json_data}")
            event_name = json_data.get(EVENT_KEY)
            logger.info(f"Event: {event_name}")
            handler = self.get_event_handler(event_name)
            if handler is None:
                print(f"Error handling event message of type: {event_name}")

            else:
                await handler(json_data)

        except Exception as e:
            print(f"Error handling message: {e}")

    def get_event_handler(self, event: str):
        logger.info(f"Event: {event}")
        return {
            DISCOVERY_EVENT: self._discovery_event,
            CONFIGURATION_LOAD_EVENT: self._configuration_load_event,
        }.get(event)

    async def _discovery_event(self, event_data: Dict[str, str]):
        async with self.lock:
            logger.info(f"Discovery Event: {event_data}")
            self.cache[DISCOVERY_EVENT] = event_data

    async def _configuration_load_event(self, event_data: Dict[str, str]):
        async with self.lock:
            logger.info(f"Configuration Load Event: {event_data}")
            self.cache[CONFIGURATION_LOAD_EVENT] = event_data

    # Custom ping handler
    def on_ping(self, data: bytes):
        logger.info(f"Received ping with data: {data}")
        # Send a custom readiness message, "ready", as expected by protocol
        self.write_message(CONNECTION_READY_MESSAGE)
