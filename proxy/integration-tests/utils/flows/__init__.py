import yaml

from utils.flows import *
from utils.consts import *
from utils.flows.flow import FlowRepresentation
from utils.flows.gateway_config import GatewayConfigRequests
from utils.flows.resources import ResourceQuotaRepresentation
from utils.flows.resources.handler import read_resource_file, write_resource_file
from toolkit_testing.integration_tests.docker import write_file, read_file

__all__ = [
    "read_flow_file",
    "write_flow_file",
    "read_resource_file",
    "write_resource_file",
    "FlowRepresentation",
    "GatewayConfigRequests",
    "ResourceQuotaRepresentation",
]


async def read_flow_file(
    flow_filename: str, container_name: str = LUNAR_PROXY_SERVICE_NAME
) -> str:
    existing_policies_file = await read_file(
        container_name=container_name,
        directory_path=FLOWS_DIRECTORY,
        file=flow_filename,
    )
    return yaml.safe_load(existing_policies_file)


async def write_flow_file(
    flow_filename: str,
    flow_yaml: str,
    container_name: str = LUNAR_PROXY_SERVICE_NAME,
):
    await write_file(
        container_name=container_name,
        directory_path=FLOWS_DIRECTORY,
        file=flow_filename,
        content=flow_yaml,
    )
