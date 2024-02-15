import logging
import asyncio
from json import loads
from typing import Dict
from tornado.websocket import WebSocketHandler

DISCOVERY_EVENT = "discovery-event"
EVENT_KEY = "event"
DATA_KEY = "data"


class WebSocketHubHandler(WebSocketHandler):
    def initialize(self, cache: Dict[str, Dict[str, str]], lock: asyncio.Lock):
        self.cache = cache
        self.lock = lock

    async def on_message(self, message: str | bytes):
        await self.handle_message(message)

    async def handle_message(self, message: str | bytes):
        try:
            json_data = loads(message)

            event_name = json_data.get(EVENT_KEY)
            handler = self.get_event_handler(event_name)
            if handler is None:
                print(f"Error handling event message of type: {event_name}")

            else:
                await handler(json_data)

        except Exception as e:
            logging.error(f"Error handling message: {e}")

    def get_event_handler(self, event: str):
        return {DISCOVERY_EVENT: self._discovery_event}.get(event)

    async def _discovery_event(self, event_data: Dict[str, str]):
        async with self.lock:
            self.cache[DISCOVERY_EVENT] = event_data
