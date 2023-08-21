from typing import Optional, Tuple

from toolkit_testing.integration_tests.routing import (
    Routing,
    RoutingType,
    RoutingScheme,
)
from toolkit_testing.integration_tests.client import (
    ProxyClientHelper,
    ProviderClientHelper,
    ClientResponse,
)
import utils.consts as consts

_proxy_client_helper = ProxyClientHelper(proxy_host="http://localhost", proxy_port=8000)
_provider_client_helper = ProviderClientHelper()


def extract_scheme(raw: str) -> RoutingScheme:
    if raw == "https":
        return RoutingScheme.Https
    elif raw == "http":
        return RoutingScheme.Http
    else:
        raise Exception(f"supplied scheme `{raw}` is unsupported")


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
) -> ClientResponse:
    headers = {header_key: header_value} if header_key and header_value else None

    requested_host, requested_port = (host, port) if is_proxified else _mock_host(host)
    routing_type = (
        RoutingType.HeaderBased
        if header_based_redirection
        else RoutingType.QueryParamBased
    )
    routing = Routing(
        requested_host=requested_host,
        requested_port=requested_port,
        requested_scheme=extract_scheme(scheme),
        type=routing_type,
    )

    if is_proxified:
        client = _proxy_client_helper
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
