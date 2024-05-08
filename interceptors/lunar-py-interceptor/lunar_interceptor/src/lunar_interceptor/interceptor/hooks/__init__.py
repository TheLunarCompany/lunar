from .aiohttp import AioHttpHook
from .requests import RequestsHook

LUNAR_HOOKS = [AioHttpHook, RequestsHook]
