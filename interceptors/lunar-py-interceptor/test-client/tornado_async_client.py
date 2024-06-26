import sys
from os import getenv

import tornado.ioloop
from tornado.web import RequestHandler, Application
from tornado.httpclient import AsyncHTTPClient

import lunar_interceptor  # type: ignore [reportUnusedImport]

_HTTPBINMOCK_BASE_URL = "http://httpbinmock"


def run():
    app = Application(
        [
            ("/trigger", Trigger),
            ("/trigger_post", TriggerPost),
            ("/trigger_headers", TriggerHeaders),
            ("/trigger_dynamic", TriggerDynamic),
            ("/trigger_retry", TriggerRetry),
            ("/trigger_local", TriggerLocal),
            ("/trigger_bad_url", TriggerBadUrl),
            ("/healthcheck", HealthCheck),
        ]
    )
    host = getenv("LUNAR_PROXY_HOST", "")
    print(f"Client is up. Python version: {sys.version}. Proxy is at {host}")

    app.listen(8080)
    tornado.ioloop.IOLoop.current().start()


class Trigger(RequestHandler):
    async def get(self):
        http_client = AsyncHTTPClient()
        resp = await http_client.fetch(
            f"{_HTTPBINMOCK_BASE_URL}/uuid", headers=self.request.headers
        )
        self.set_status(resp.code)

        for key, value in resp.headers.get_all():
            self.set_header(key, value)

        self.write(resp.body)
        self.flush()


class TriggerPost(RequestHandler):
    async def post(self):
        http_client = AsyncHTTPClient()
        print(self.request.body)
        resp = await http_client.fetch(
            f"{_HTTPBINMOCK_BASE_URL}/post", method="POST", body=self.request.body
        )
        self.set_status(resp.code)

        for key, value in resp.headers.get_all():
            self.set_header(key, value)

        self.write(resp.body)
        self.flush()


class TriggerHeaders(RequestHandler):
    async def get(self):
        http_client = AsyncHTTPClient()
        resp = await http_client.fetch(
            f"{_HTTPBINMOCK_BASE_URL}/headers", headers=self.request.headers
        )
        self.set_status(resp.code)

        for key, value in resp.headers.get_all():
            self.set_header(key, value)

        self.write(resp.body)
        self.flush()


class TriggerBadUrl(RequestHandler):
    async def get(self):
        http_client = AsyncHTTPClient()
        resp = await http_client.fetch(f"{_HTTPBINMOCK_BASE_URL}/anything/bad_url")
        self.set_status(resp.code)

        for key, value in resp.headers.get_all():
            self.set_header(key, value)

        self.write(resp.body)
        self.flush()


class TriggerLocal(RequestHandler):
    async def get(self):
        http_client = AsyncHTTPClient()
        resp = await http_client.fetch(
            f"{_HTTPBINMOCK_BASE_URL}/uuid", headers=self.request.headers
        )
        self.set_status(resp.code)

        for key, value in resp.headers.get_all():
            self.set_header(key, value)

        self.write(resp.body)
        self.flush()


class TriggerDynamic(RequestHandler):
    async def get(self):
        method = self.get_argument("method", default="")
        url = self.get_argument("url", default="")
        http_client = AsyncHTTPClient()
        resp = await http_client.fetch(url, method=method.upper())

        self.set_status(resp.code)

        for key, value in resp.headers.get_all():
            self.set_header(key, value)

        self.write(resp.body)
        self.flush()


class TriggerRetry(RequestHandler):
    async def get(self):
        http_client = AsyncHTTPClient()
        resp = await http_client.fetch(f"{_HTTPBINMOCK_BASE_URL}/anything/retry/attempt")
        self.set_status(resp.code)

        for key, value in resp.headers.get_all():
            self.set_header(key, value)

        self.write(resp.body)
        self.flush()


class HealthCheck(RequestHandler):
    async def get(self):
        self.set_status(200)
        self.write({"status": "OK"})
        self.flush()


if __name__ == "__main__":
    run()
