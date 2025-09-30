from typing import Optional, Tuple

from toolkit_testing.integration_tests import routing
from toolkit_testing.integration_tests.routing import (
    Routing,
    RoutingType,
    RoutingScheme,
)
from toolkit_testing.integration_tests.client import (
    ProxyClientHelper,
    ProviderClientHelper,
    ClientResponse,
    ProxyTLSPassthroughClientHelper,
)
import utils.consts as consts

_proxy_clients = {
    "0": ProxyClientHelper(proxy_host="http://localhost", proxy_port=8000),
    "1": ProxyClientHelper(proxy_host="http://localhost", proxy_port=8001),
    "2": ProxyClientHelper(proxy_host="http://localhost", proxy_port=8002),
}

_tls_passthrough_client = ProxyTLSPassthroughClientHelper(
    proxy_host="http://localhost", proxy_port=8880
)
_provider_client_helper = ProviderClientHelper()


def extract_scheme(raw: str) -> RoutingScheme:
    if raw == "https":
        return RoutingScheme.Https
    elif raw == "http":
        return RoutingScheme.Http
    else:
        raise Exception(f"supplied scheme `{raw}` is unsupported")


async def make_tls_pass_through_request(
    url: str,
    method: str = "GET",
) -> ClientResponse:
    return await _tls_passthrough_client.make_request(method=method, url=url)


async def make_request(
    host: str,
    path: str,
    is_proxified: bool,
    header_key: str | None = None,
    header_value: str | None = None,
    port: Optional[int] = 80,
    method: str = "GET",
    header_based_redirection: bool = True,
    scheme: str = "http",
    proxy_id: str = "0",
    use_x_lunar_host: bool = True,
    with_routing_type: bool = True,
) -> ClientResponse:
    headers = {header_key: header_value} if header_key and header_value else None
    host = host.replace(":80", "").replace(":443", "")
    requested_host, requested_port = (host, port) if is_proxified else _mock_host(host)
    routing_type = (
        (
            RoutingType.HeaderBased
            if header_based_redirection
            else RoutingType.QueryParamBased
        )
        if with_routing_type
        else RoutingType.BadType
    )

    routing = Routing(
        requested_host=requested_host,
        requested_scheme=extract_scheme(scheme),
        type=routing_type,
        use_x_lunar_host=use_x_lunar_host and header_based_redirection,
    )
    if requested_port not in [80, 443]:
        routing.requested_port = requested_port

    if is_proxified:
        client = _proxy_clients[proxy_id]
    else:
        client = _provider_client_helper

    return await client.make_request(
        method=method, routing=routing, path=path, headers=headers
    )


def _mock_host(original_host: str) -> Tuple[str, int]:
    """Because tests run outside of docker, we must use different ports
    to distinguish between mock providers.
    This function contains a match clause which maps mock providers to ports.

    Args:
        host (str): Mock provider hostname
    Returns:
        str: <host>:<port> needed to reach mock provider outside of docker
    """
    url_prefix = "http://localhost"
    match original_host:
        case consts.MOX_SERVICE_NAME:
            port = 8888
        case consts.HTTPBIN_SERVICE_NAME:
            port = 8080
        case _:
            port = 80
    return url_prefix, port


async def request(
    host: str,
    path: str,
    scheme: str,
    port: int,
    proxy_id: str = "0",
) -> ClientResponse:
    client = _proxy_clients[proxy_id]
    routing = Routing(requested_host=host, requested_scheme=extract_scheme(scheme))
    if port not in [80, 443]:
        routing.requested_port = port

    response = await client.make_request(routing=routing, path=path)
    return response
