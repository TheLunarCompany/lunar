import uuid
from typing import Dict, Optional

from yarl import URL

from .const import *
from lunar_interceptor.interceptor.traffic_filter import TrafficFilter
from lunar_interceptor.interceptor.configuration import ConnectionConfig


def generate_request_id() -> str:
    """
    Generate a Request Identifier.

    Returns:
        str: A string representation of the generated ID.
    """
    return str(uuid.uuid4())


def generate_modified_headers(
    original_url: URL,
    original_headers: Optional[Dict[str, str]],
    sequence_id: Optional[str],
    traffic_filter: TrafficFilter,
    lunar_tenant_id: str,
    lunar_req_id: str,
) -> Dict[str, str]:
    """
    Generate the headers to support the proxy work flow.

    Args:
        original_url (yarl.URL):The url object converted by the original url passed to the request.
        original_headers (Dict[str ,str]): The dictionary of the original request headers.

    Returns:
        Dict[str, str]: A modified dictionary of headers.
    """
    if original_url.host is None:
        raise Exception("Could not parse the hostname, reverting to original flow.")

    destination_port = original_url.port

    host = (
        f"{original_url.host}:{destination_port}"
        if destination_port is not None and not original_url.is_default_port()
        else original_url.host
    )

    modified_headers: Dict[str, str] = original_headers if original_headers else {}

    modified_headers[X_LUNAR_HOST_HEADER_KEY] = host
    modified_headers[X_LUNAR_REQ_ID_HEADER_KEY] = lunar_req_id
    modified_headers[X_LUNAR_SCHEME_HEADER_KEY] = original_url.scheme
    modified_headers[X_LUNAR_INTERCEPTOR_HEADER_KEY] = LUNAR_INTERCEPTOR_HEADER_VALUE
    if traffic_filter.managed:
        modified_headers[X_LUNAR_TENANT_ID_HEADER_KEY] = lunar_tenant_id

    if sequence_id is not None:
        modified_headers[LUNAR_SEQ_ID_HEADER_KEY] = sequence_id

    return modified_headers


def generate_modified_url(
    connection_config: ConnectionConfig, original_url: URL
) -> URL:
    """
    Generate the required url to connect through the proxy instead of the original host.

    Args:
        original_url (yarl.URL): The url object converted by the original url passed to the request.

    Returns:
        URL: An url object that point to Lunar proxy.
    """
    return (
        original_url.with_scheme(connection_config.proxy_scheme)
        .with_host(connection_config.proxy_host)
        .with_port(connection_config.proxy_port)
    )
