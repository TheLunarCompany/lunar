# type: ignore
# This is since `behave` is really mistyped and all dynamic.
# Might be handled later.
from behave import when, then, register_type
from behave.api.async_step import async_run_until_complete
from json import loads
from typing import Any, Literal
from utils.consts import ERROR_HEADER_KEY
from utils.client import make_request
from utils.helpers import get_key_path

_PROXIFIED_STR = "through Lunar Proxy"
_NOT_PROXIFIED_STR = "directly to API Provider"


def parse_is_proxified(text: str) -> bool:
    if text == _PROXIFIED_STR:
        return True
    if text == _NOT_PROXIFIED_STR:
        return False
    raise Exception("unsupported")


def have_or_not(text: str) -> bool:
    if text == "have":
        return True
    if text == "dont have":
        return False
    raise Exception("unsupported")


def parse_int(text: str) -> int:
    return int(text)


register_type(IsProxified=parse_is_proxified)
register_type(Int=parse_int)
register_type(HaveOrNot=have_or_not)


@when(
    "Request to {scheme}:// {host} :{port:Int} {path:Path} is made through Lunar Proxy without query param based redirection"
)
@async_run_until_complete
async def step_impl(context: Any, scheme: str, host: str, port: int, path: str):
    response = await make_request(
        host=host,
        path=path,
        is_proxified=True,
        header_based_redirection=True,
        scheme=scheme,
        port=port,
    )
    context.proxified_response = response


@when(
    "Request to {scheme}:// {host} :{port:Int} {path:Path} is made through Lunar Proxy without x-lunar-host header nor query param based redirection"
)
@async_run_until_complete
async def step_impl(context: Any, scheme: str, host: str, port: int, path: str):
    response = await make_request(
        host=host,
        path=path,
        is_proxified=True,
        header_based_redirection=True,
        scheme=scheme,
        port=port,
        use_x_lunar_host=False,
        with_routing_type=False,
    )
    context.proxified_response = response


@when(
    "Request to {method} {scheme}:// {host} :{port:Int} {path:Path} is made {is_proxified:IsProxified}"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    scheme: str,
    host: str,
    port: int,
    path: str,
    method: str,
    is_proxified: bool,
):
    response = await make_request(
        host=host,
        path=path,
        is_proxified=is_proxified,
        scheme=scheme,
        port=port,
        method=method,
    )
    if is_proxified:
        context.proxified_response = response
    else:
        context.direct_response = response


@when(
    "Request to {scheme}:// {host} :{port:Int} {path:Path} is made {is_proxified:IsProxified}"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    scheme: str,
    host: str,
    port: int,
    path: str,
    is_proxified: bool,
):
    response = await make_request(
        host=host, path=path, is_proxified=is_proxified, scheme=scheme, port=port
    )
    if is_proxified:
        context.proxified_response = response
    else:
        context.direct_response = response


# this step allows passing request with no port in Host header
@when("Request to {scheme}:// {host} {path:Path} is made {is_proxified:IsProxified}")
@async_run_until_complete
async def step_impl(
    context: Any,
    scheme: str,
    host: str,
    path: str,
    is_proxified: bool,
):
    response = await make_request(
        host=host, path=path, is_proxified=is_proxified, scheme=scheme, port=None
    )
    if is_proxified:
        context.proxified_response = response
    else:
        context.direct_response = response


@when(
    "A request to {scheme}:// {host} :{port} {path:Path} is made through Lunar Proxy with query param based redirection"
)
@async_run_until_complete
async def step_impl(context: Any, scheme: str, host: str, port: int, path: str):
    response = await make_request(
        host=host,
        path=path,
        port=port,
        is_proxified=True,
        header_based_redirection=False,
        scheme=scheme,
    )
    context.proxified_response = response


@when(
    "A request to {scheme}:// {host} :{port} {path:Path} is made through Lunar Proxy with query param based redirection using host header"
)
@async_run_until_complete
async def step_impl(context: Any, scheme: str, host: str, port: int, path: str):
    response = await make_request(
        host=host,
        path=path,
        port=port,
        is_proxified=True,
        header_based_redirection=False,
        scheme=scheme,
        use_x_lunar_host=False,
    )
    context.proxified_response = response


@when(
    "A request to {scheme}:// {host} {path:Path} is made to proxy with header '{header_key}: {header_value}'"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    scheme: str,
    host: str,
    path: str,
    header_key: str | None,
    header_value: str | None,
):
    response = await make_request(
        host=host,
        path=path,
        is_proxified=True,
        header_key=header_key,
        header_value=header_value,
    )
    context.proxified_response = response


@when(
    "A request to {scheme}:// {host} :{port:Int} {path:Path} is made {is_proxified:IsProxified} with header '{header_key}: {header_value}'"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    scheme: str,
    host: str,
    path: str,
    port: int,
    is_proxified: bool,
    header_key: str | None,
    header_value: str | None,
):
    response = await make_request(
        host=host,
        path=path,
        is_proxified=is_proxified,
        header_key=header_key,
        header_value=header_value,
        scheme=scheme,
        port=port,
    )
    if is_proxified:
        context.proxified_response = response
    else:
        context.direct_response = response


@when(
    "A request to {scheme}:// {host} :{port} {path:Path} is made {is_proxified:IsProxified} with previously returned sequence id"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    scheme: str,
    host: str,
    port: int,
    path: str,
    is_proxified: bool,
):
    response = await make_request(
        host,
        path,
        is_proxified,
        port=port,
        scheme=scheme,
        header_key="x-lunar-sequence-id",
        header_value=context.proxified_response.headers.get(
            "x-lunar-sequence-id", None
        ),
    )
    if is_proxified:
        context.proxified_response = response
    else:
        context.direct_response = response


@when(
    "A request to {scheme}:// {host} :{port} {path:Path} is made {is_proxified:IsProxified}"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    scheme: str,
    host: str,
    port: int,
    path: str,
    is_proxified: bool,
):
    response = await make_request(host, path, is_proxified, port=port, scheme=scheme)
    if is_proxified:
        context.proxified_response = response
    else:
        context.direct_response = response


@when(
    "A request is made {is_proxified:IsProxified} with header '{header_key}: {header_value}'"
)
@async_run_until_complete
async def step_impl(
    context: Any,
    is_proxified: bool,
    header_key: str | None,
    header_value: str | None,
):
    response = await make_request(
        "mox",
        "/uuid",
        is_proxified=is_proxified,
        header_key=header_key,
        header_value=header_value,
        port=8888,
    )
    if is_proxified:
        context.proxified_response = response
    else:
        context.direct_response = response


@when("A request to {host} {path:Path} is made {is_proxified:IsProxified}")
@async_run_until_complete
async def step_impl(
    context: Any,
    host: str,
    path: str,
    is_proxified: bool,
):
    response = await make_request(host, path, is_proxified)
    if is_proxified:
        context.proxified_response = response
    else:
        context.direct_response = response


@then("Responses have the same body and status")
@async_run_until_complete
async def step_impl(context: Any):
    print("***")
    print(context.direct_response)
    print("***")
    print(context.proxified_response)
    print("***")
    assert context.direct_response.body == context.proxified_response.body
    assert context.direct_response.status == context.proxified_response.status


@then("Proxified response body's `{key_path}` is {expected_value}")
@async_run_until_complete
async def step_impl(context: Any, key_path: str, expected_value: str):
    print(f"proxified response: {context.proxified_response}")
    body = loads(context.proxified_response.body)
    value, found = get_key_path(body, key_path)
    assert found, f"key {key_path} not found in response body"
    assert value == expected_value


@then("Proxified response body has no key `{key_path}`")
@async_run_until_complete
async def step_impl(context: Any, key_path: str):
    print(f"proxified response: {context.proxified_response}")
    body = loads(context.proxified_response.body)
    _, found = get_key_path(body, key_path)
    assert not found, f"key {key_path} found in response body"


@then("Response {have:HaveOrNot} the error indicator header")
@async_run_until_complete
async def step_impl(context: Any, have: bool):
    print("***")
    print(context.proxified_response)
    print("***")
    if have:
        assert ERROR_HEADER_KEY in context.proxified_response.headers
    else:
        assert ERROR_HEADER_KEY not in context.proxified_response.headers


@then("Response error message should be `{errorMessage}`")
@async_run_until_complete
async def step_impl(context: Any, errorMessage: str):
    print("***")
    print(context.proxified_response)
    print("***")
    print(f"proxified response: {context.proxified_response}")
    body = context.proxified_response.body
    print(f"body: {body}")
    assert errorMessage == body
