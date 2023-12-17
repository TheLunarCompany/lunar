from importlib.metadata import metadata
import aiohttp
from json import dumps
from aiohttp import web, ClientSession
import sys
from os import getenv
import lunar_interceptor  # type: ignore [reportUnusedImport]

# This small web server is where Lunar Interceptor is actually installed & running in these tests.
# It represents an actual client application which makes and HTTP call, once GET /trigger is called.
# This allows the tests themselves to test the Interceptor as an unknown-box, from the outside.
# This client is currently built using AioHttp, in the future we might develop other types of interceptors,
# which will require other clients accordingly.

_HTTPBINMOCK_BASE_URL = "http://httpbinmock"


def run():
    app = web.Application()
    app.add_routes(
        [
            web.get("/trigger", _trigger),
            web.post("/trigger_post", _trigger_post),
            web.get("/trigger_headers", _trigger_headers),
            web.get("/trigger_dynamic", _trigger_dynamic),
            web.get("/trigger_retry", _trigger_retry),
            web.get("/trigger_local", _trigger_local),
            web.get("/trigger_bad_url", _trigger_bad_url),
            web.get("/healthcheck", _healthcheck),
        ]
    )
    host = getenv("LUNAR_PROXY_HOST", "")
    print(
        f"Client is up. Python version: {sys.version}. AioHttp version {aiohttp.__version__}. Proxy is at {host}"
    )
    web.run_app(app, port=8080)  # type: ignore


# This function handles the call to GET /trigger.
# It sends out a call to http://httpbinmock/uuid and returns the call's response.
# Since Lunar Interceptor is running, the call might seamlessly return from Lunar Proxy,
# if it is up and running.
# In this application layer, this detail is transparent;
# however, the test layer, which calls GET /trigger, can discern this and assert upon it accordingly.


async def _trigger(req: web.Request) -> web.Response:
    async with ClientSession() as session:
        async with session.get(
            f"{_HTTPBINMOCK_BASE_URL}/uuid", headers=req.headers
        ) as resp:
            body = await resp.text()
            return web.Response(status=resp.status, body=body, headers=resp.headers)


async def _trigger_post(req: web.Request) -> web.Response:
    async with ClientSession() as session:
        async with session.post(
            f"{_HTTPBINMOCK_BASE_URL}/post", json=await req.json()
        ) as resp:
            body = await resp.text()
            return web.Response(status=resp.status, body=body, headers=resp.headers)


async def _trigger_headers(req: web.Request) -> web.Response:
    async with ClientSession() as session:
        async with session.get(
            f"{_HTTPBINMOCK_BASE_URL}/headers", headers=req.headers
        ) as resp:
            body = await resp.text()
            return web.Response(status=resp.status, body=body, headers=resp.headers)


async def _trigger_bad_url(_: web.Request) -> web.Response:
    async with ClientSession() as session:
        async with session.get(f"{_HTTPBINMOCK_BASE_URL}/anything/bad_url") as resp:
            body = await resp.text()
            return web.Response(status=resp.status, body=body, headers=resp.headers)


async def _trigger_local(req: web.Request) -> web.Response:
    async with ClientSession() as session:
        async with session.get(
            f"{_HTTPBINMOCK_BASE_URL}/uuid", headers=req.headers
        ) as resp:
            body = await resp.text()
            return web.Response(status=resp.status, body=body, headers=resp.headers)


async def _trigger_dynamic(req: web.Request) -> web.Response:
    try:
        method = req.rel_url.query["method"]
        url = req.rel_url.query["url"]
    except:
        raise Exception("must supply method and URL in query params")

    async with ClientSession() as session:
        async with session.request(method=method, url=url) as resp:
            body = await resp.text()
            return web.Response(status=resp.status, body=body)


async def _trigger_retry(_: web.Request) -> web.Response:
    async with ClientSession() as session:
        async with session.get(
            f"{_HTTPBINMOCK_BASE_URL}/anything/retry/attempt"
        ) as resp:
            body = await resp.text()
            return web.Response(status=resp.status, body=body, headers=resp.headers)


_HEALTHCHECK_RESPONSE = {"status": "OK"}


async def _healthcheck(_: web.Request) -> web.Response:
    return web.Response(status=200, body=dumps(_HEALTHCHECK_RESPONSE))


if __name__ == "__main__":
    run()
