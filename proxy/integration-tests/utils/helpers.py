import asyncio
from functools import partial
from typing import Any, Awaitable, Callable
from aiohttp import ClientSession


async def retry_async(
    f: Callable[[], Awaitable[None]], name: str, attempts: int, sleep_s: float
):
    print(f"trying {name}...")
    for attempt in range(attempts):
        try:
            await f()
            print(f"{name} succeeded")
            return
        except Exception as ex:
            print(
                f"{name} failed: will wait {sleep_s} seconds, then try again ({attempt + 1}/{attempts}) (error: {ex})"
            )
            await asyncio.sleep(sleep_s)
    raise Exception(f"{name} failed: exhausted all {attempts} retry attempts")


async def healthcheck(
    method: str,
    url: str,
    status_predicate: Callable[[int], bool],
    attempts: int,
    sleep_s: float,
):
    return await retry_async(
        f=partial(_single_healthcheck, method, url, status_predicate),
        name=f"{method}:::{url} healthcheck",
        attempts=attempts,
        sleep_s=sleep_s,
    )


async def _single_healthcheck(
    method: str,
    url: str,
    status_predicate: Callable[[int], bool],
):
    async with ClientSession() as session:
        async with session.request(method=method, url=url) as resp:
            status = resp.status
            resp_body = await resp.text()
            print(f"healthcheck response: {status} {resp_body}")
            if status_predicate(status):
                return
            raise Exception("healthcheck failed ")


def parse_int(text: str) -> int:
    return int(text)


def get_key_path(obj: dict[str, Any], key_path: str) -> tuple[Any, bool]:
    key_path_parts = key_path.split(".")
    value = obj
    for key in key_path_parts:
        if key not in value:
            return None, False
        value = value[key]
    return value, True
