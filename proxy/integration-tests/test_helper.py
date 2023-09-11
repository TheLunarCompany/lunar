from typing import Dict
import aiohttp

from dataclasses import dataclass
from multidict import CIMultiDictProxy


PROXY_HOST = "sebas-test.lunarhq.dev"
BASE64_PATH = "/base64/{value}"
ANYTHING_PATH = "/anything"
PATH_FACT = "/fact"
HTTPBIN_HOST = "httpbin.org"
CATFACT_HOST = "catfact.ninja"

HTTP_PORT = 80
HTTPS_PORT = 443


GET = "GET"
POST = "POST"

HTTP = "http"
HTTPS = "https"


@dataclass
class ResponseData:
    body: str
    headers: CIMultiDictProxy[str]
    status: int


async def make_request(
    method: str,
    url: str,
    host_header: str,
    body: str | None = None,
    headers: Dict[str, str] | None = None,
) -> ResponseData:
    if headers is None:
        headers = {}
    async with aiohttp.ClientSession() as client:
        async with client.request(
            method,
            url,
            headers={"Host": host_header, **headers},
            data=body,
            allow_redirects=False,
        ) as resp:
            response_headers = resp.headers
            response_body = await resp.text()

            return ResponseData(
                body=response_body,
                headers=response_headers,
                status=resp.status,
            )


def build_url(scheme: str, host: str, path: str):
    return f"{scheme}://{host}{path}"
