import yaml

from utils.consts import *
from toolkit_testing.integration_tests.docker import write_file, read_file


async def read_resource_file(
    filename: str,
    container_name: str = LUNAR_PROXY_SERVICE_NAME,
    directory_path: str = RESOURCES_DIRECTORY,
) -> str:
    existing_policies_file = await read_file(
        container_name=container_name,
        directory_path=directory_path,
        file=filename,
    )
    return yaml.safe_load(existing_policies_file)


async def write_resource_file(
    filename: str,
    resource_yaml: str,
    container_name: str = LUNAR_PROXY_SERVICE_NAME,
    directory_path: str = RESOURCES_DIRECTORY,
):
    await write_file(
        container_name=container_name,
        directory_path=directory_path,
        file=filename,
        content=resource_yaml,
    )
